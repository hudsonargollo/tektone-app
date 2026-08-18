import { useEffect, useState } from "react";
import { ArrowLeft, LayoutTemplate, Plus, Trash2, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";
import BoardEditor from "@/boards/BoardEditor";

function ShareModal({ board, onClose }) {
  const [collaborators, setCollaborators] = useState(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api.listBoardCollaborators(board.id).then((r) => setCollaborators(r.collaborators)).catch(() => {});
  }
  useEffect(load, [board.id]);

  async function add() {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api.addBoardCollaborator(board.id, email.trim(), "editor");
      setEmail("");
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao adicionar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(target) {
    await api.removeBoardCollaborator(board.id, target).catch(() => {});
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl surface-2 p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="label-tech">Compartilhar "{board.title}"</p>
          <button onClick={onClose} className="rounded-lg p-1 text-stone-500 hover:bg-ink/[0.05]">
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="email@tektone.com.br"
            className="flex-1 rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <button
            onClick={add}
            disabled={busy}
            className="rounded-lg bg-action px-3 py-2 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
          >
            adicionar
          </button>
        </div>
        {error && <p className="mb-2 font-mono text-[11px] text-danger">{error}</p>}

        {!collaborators ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-1.5">
            {collaborators.map((c) => (
              <div key={c.user_email} className="flex items-center justify-between rounded-lg surface-3 px-3 py-2">
                <div>
                  <p className="text-sm text-ink">{c.user_email}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">{c.role}</p>
                </div>
                {c.role !== "owner" && (
                  <button onClick={() => remove(c.user_email)} className="rounded-lg p-1.5 text-stone-500 hover:bg-danger/10 hover:text-danger">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BoardsPanel({ onClose }) {
  const [boards, setBoards] = useState(null);
  const [error, setError] = useState("");
  const [openBoard, setOpenBoard] = useState(null); // { id, title } | null
  const [shareBoard, setShareBoard] = useState(null);
  const [creating, setCreating] = useState(false);

  function load() {
    api.listBoards().then((r) => setBoards(r.boards)).catch((e) => setError(e.body?.error || "Falha ao carregar."));
  }
  useEffect(load, []);

  async function createBoard() {
    setCreating(true);
    try {
      const { board } = await api.createBoard("Sem título");
      setOpenBoard({ id: board.id, title: board.title });
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao criar board.");
    } finally {
      setCreating(false);
    }
  }

  async function removeBoard(id) {
    if (!window.confirm("Excluir este board? Essa ação não pode ser desfeita.")) return;
    await api.deleteBoard(id).catch(() => {});
    load();
  }

  if (openBoard) {
    return <BoardEditor boardId={openBoard.id} title={openBoard.title} onClose={() => { setOpenBoard(null); load(); }} />;
  }

  return (
    <div className="flex h-full w-full flex-col surface-2">
      <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="-ml-1.5 rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink lg:hidden"
          >
            <ArrowLeft size={16} />
          </button>
          <LayoutTemplate size={15} className="text-action" />
          <span className="label-tech">Boards</span>
        </div>
        <button
          onClick={createBoard}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-lg bg-action px-2.5 py-1.5 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
        >
          {creating ? <Spinner /> : <Plus size={12} />} novo board
        </button>
      </div>

      <div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-6 py-5">
        {error && <p className="mb-3 font-mono text-[11px] text-danger">{error}</p>}

        {!boards ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : boards.length === 0 ? (
          <p className="text-sm text-stone-500">Nenhum board ainda. Crie o primeiro.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {boards.map((b) => (
              <div key={b.id} className="rounded-xl surface-3 p-4">
                <button
                  onClick={() => setOpenBoard({ id: b.id, title: b.title })}
                  className="block w-full text-left"
                >
                  <p className="truncate font-semibold text-ink">{b.title}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-stone-500">
                    atualizado {new Date(b.updated_at + "Z").toLocaleString("pt-BR")}
                  </p>
                </button>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setShareBoard(b)}
                    className="flex items-center gap-1.5 rounded-lg surface-2 px-2.5 py-1.5 font-mono text-[11px] text-stone-600"
                  >
                    <Users size={12} /> compartilhar
                  </button>
                  <button
                    onClick={() => removeBoard(b.id)}
                    className="flex items-center gap-1.5 rounded-lg surface-2 px-2.5 py-1.5 font-mono text-[11px] text-danger"
                  >
                    <Trash2 size={12} /> excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {shareBoard && <ShareModal board={shareBoard} onClose={() => setShareBoard(null)} />}
    </div>
  );
}
