"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import { Clock, User } from "lucide-react";

/**
 * Static mock of the Hub Tektone client portal — a kanban-style board used
 * as the visual subject of the scroll-driven storytelling sequence in
 * HubTektoneSection. Illustrative content, not a live screenshot.
 */

type Card = { title: string; deadline?: string; assignee?: string };

const COLUMNS: { label: string; cards: Card[] }[] = [
  {
    label: "Em Andamento",
    cards: [
      { title: "Integração de pagamentos" },
      { title: "Dashboard de métricas" },
    ],
  },
  {
    label: "Em Revisão",
    cards: [{ title: "Fluxo de autenticação", deadline: "18 ago", assignee: "H. Argollo" }],
  },
  {
    label: "Concluído",
    cards: [{ title: "Onboarding do cliente" }],
  },
];

function BoardCard({
  card,
  highlightIntensity,
}: {
  card: Card;
  highlightIntensity: MotionValue<number>;
}) {
  const isHighlightable = card.deadline !== undefined;
  const scale = useTransform(highlightIntensity, [0, 1], isHighlightable ? [1, 1.05] : [1, 1]);
  const ringOpacity = useTransform(highlightIntensity, [0, 1], isHighlightable ? [0, 1] : [0, 0]);

  return (
    <motion.div
      style={{ scale }}
      className="relative rounded-lg surface-ink-3 p-3"
    >
      <motion.div
        aria-hidden
        style={{ opacity: ringOpacity }}
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-green-mist"
      />
      <p className="relative truncate text-xs sm:text-sm font-medium text-ivory">
        {card.title}
      </p>
      {(card.deadline || card.assignee) && (
        <div className="relative mt-2 flex flex-wrap items-center gap-2.5 font-mono text-[10px] text-sand">
          {card.deadline && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {card.deadline}
            </span>
          )}
          {card.assignee && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {card.assignee}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function HubBoard({
  highlightIntensity,
}: {
  highlightIntensity: MotionValue<number>;
}) {
  return (
    <div className="w-full max-w-4xl rounded-2xl surface-ink-2 p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-success-mist/60" />
        <span className="ml-3 label-tech-ink">Hub Tektone</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.label} className="min-w-0">
            <p className="mb-3 truncate font-mono text-[10px] sm:text-xs tracking-[0.15em] uppercase text-sand">
              {col.label}
            </p>
            <div className="space-y-2.5">
              {col.cards.map((card) => (
                <div key={card.title} className="relative">
                  <BoardCard card={card} highlightIntensity={highlightIntensity} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
