import { useEffect, useRef, useState, type ReactNode } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import type { PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import { GripVertical } from "lucide-react-native";
import { colors } from "@/lib/theme";

// Hand-rolled drag-to-reorder list. Deliberately NOT react-native-reanimated
// (no `react-native-draggable-flatlist` either, which depends on it) —
// react-native-reanimated/react-native-worklets are pinned below
// Expo-recommended versions in this project because newer ones segfault
// inside Expo Go SDK 57's bundled libworklets.so (see (app)/_layout.tsx's
// ShakeWrapper comment, the established precedent: use RN core Animated,
// not reanimated, for any new animated UI). This uses
// react-native-gesture-handler's classic PanGestureHandler + Animated.event
// with useNativeDriver — that combination has never depended on reanimated;
// it's the same pattern gesture-handler shipped years before reanimated
// existed. Confirmed zero react-native-reanimated imports in this file.
//
// Fixed-row-height model (rowHeight prop) — no onLayout measurement, so
// reordering math (translationY / rowHeight) stays simple and synchronous.
// Only one row can drag at a time (each row's own PanGestureHandler only
// activates on a touch starting on ITS grip). A dedicated grip icon is the
// only draggable hit-target so tapping the row body for its own purpose
// (e.g. opening a block's property panel) doesn't fight the gesture.
//
// UNTESTED ON A REAL DEVICE — gesture timing/native-driver interaction can
// behave differently on-device than static review can confirm. Hands-on
// test before shipping (see Phase 11 commit message).
export type DraggableListProps<T> = {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  rowHeight: number;
  onReorder: (next: T[]) => void;
  renderItem: (item: T, index: number, dragging: boolean) => ReactNode;
};

export default function DraggableList<T>({ data, keyExtractor, rowHeight, onReorder, renderItem }: DraggableListProps<T>) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeIndexRef = useRef<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  // useState's lazy initializer (not useRef) for the same "create once,
  // stable identity forever" Animated.Value — react-hooks/refs flags
  // dereferencing ref.current when the value then gets passed into a
  // function call made during render (Animated.event(...) below); a state
  // value read during render is exactly what React expects, so this sidesteps
  // the false positive without changing any runtime behavior — dy is still
  // never replaced via its setter, only mutated imperatively via
  // .setValue()/native-driven updates, same as the ref version was.
  const [dy] = useState(() => new Animated.Value(0));

  // One persistent Animated.Value per slot — these hold the "make room"
  // shift for rows NOT being dragged, separate from `dy` which only ever
  // drives the actively-dragged row's own transform. Held in state (not a
  // ref) and grown/shrunk from an effect keyed on data.length, never
  // mutated inline during render — react-hooks/refs correctly flags
  // reading/writing ref.current in the render body as unsafe under
  // concurrent rendering; state reads during render are the normal case.
  const [shifts, setShifts] = useState<Animated.Value[]>(() => data.map(() => new Animated.Value(0)));
  useEffect(() => {
    setShifts((prev) => (prev.length === data.length ? prev : data.map((_, i) => prev[i] || new Animated.Value(0))));
  }, [data.length]);

  function updateShifts(from: number, to: number) {
    shifts.forEach((v, i) => {
      if (i === from) return;
      let target = 0;
      if (from < to && i > from && i <= to) target = -rowHeight;
      else if (from > to && i < from && i >= to) target = rowHeight;
      Animated.timing(v, { toValue: target, duration: 150, useNativeDriver: true }).start();
    });
  }

  function resetAll() {
    dy.setValue(0);
    shifts.forEach((v) => v.setValue(0));
    activeIndexRef.current = null;
    hoverIndexRef.current = null;
    setActiveIndex(null);
  }

  // `any` on the listener param is deliberate — Animated.event's generic
  // inference vs. gesture-handler's NativeSyntheticEvent-wrapped payload
  // type don't line up cleanly (a known friction point between these two
  // libraries' TS defs), and the runtime shape is simply
  // PanGestureHandlerGestureEvent's nativeEvent either way.
  //
  // react-hooks/refs disabled for this block: activeIndexRef/hoverIndexRef
  // are read/written only inside `listener`, a callback invoked by the
  // gesture system on real touch events, never synchronously during
  // render — exactly the "outside render, e.g. event handlers" case the
  // rule's own docs call out as correct ref usage. The static analysis
  // can't see that this closure only runs later; it's flagging the
  // syntactic nesting inside a render-time Animated.event(...) call, not
  // an actual render-time read. Rewriting the index trackers as state
  // would reintroduce a re-render per gesture-move event — precisely what
  // native-driven Animated.event exists to avoid. (This exact rule already
  // has an unsuppressed, accepted baseline instance in (app)/_layout.tsx's
  // ShakeWrapper for the same underlying Animated-ref pattern.)
  /* eslint-disable react-hooks/refs */
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: dy } }],
    {
      useNativeDriver: true,
      listener: (e: any) => {
        const from = activeIndexRef.current;
        if (from === null) return;
        const raw = from + Math.round(e.nativeEvent.translationY / rowHeight);
        const clamped = Math.max(0, Math.min(data.length - 1, raw));
        if (clamped !== hoverIndexRef.current) {
          hoverIndexRef.current = clamped;
          updateShifts(from, clamped);
        }
      },
    }
  );
  /* eslint-enable react-hooks/refs */

  function onHandlerStateChange(index: number) {
    return (e: PanGestureHandlerStateChangeEvent) => {
      const { state } = e.nativeEvent;
      if (state === State.BEGAN) {
        activeIndexRef.current = index;
        hoverIndexRef.current = index;
        dy.setValue(0);
        setActiveIndex(index);
      } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        const from = activeIndexRef.current;
        const to = hoverIndexRef.current;
        if (from !== null && to !== null && from !== to) {
          const next = [...data];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          onReorder(next);
        }
        resetAll();
      }
    };
  }

  return (
    <View>
      {data.map((item, i) => {
        const isActive = i === activeIndex;
        // shifts[i] can be momentarily undefined for a newly-added index —
        // the growing effect hasn't committed yet on this render pass — 0
        // is a safe static fallback until it catches up.
        const translateY = isActive ? dy : shifts[i] ?? 0;
        return (
          <Animated.View
            key={keyExtractor(item, i)}
            style={[
              styles.row,
              { transform: [{ translateY }], zIndex: isActive ? 10 : 0, elevation: isActive ? 4 : 0 },
              isActive && styles.rowActive,
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>{renderItem(item, i, isActive)}</View>
            <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange(i)}>
              <Animated.View style={styles.grip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <GripVertical size={16} color={colors.stone400} />
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.clay },
  rowActive: { shadowColor: colors.ink, shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  grip: { paddingHorizontal: 8, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
});
