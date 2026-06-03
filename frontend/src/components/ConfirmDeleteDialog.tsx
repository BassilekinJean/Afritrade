import { useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

interface ConfirmDeleteDialogProps {
  open: boolean;
  projectTitle: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function ConfirmDeleteDialog({
  open,
  projectTitle,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e: any) {
      setError(e.message || "Échec de la suppression.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Supprimer le projet"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="danger" onClick={confirm} disabled={busy}>
            {busy ? "Suppression…" : "Supprimer définitivement"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-300">
        Tu es sur le point de supprimer{" "}
        <span className="font-semibold text-slate-100">« {projectTitle} »</span>.
      </p>
      <p className="mt-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">
        Cette action est irréversible : le projet et son pipeline ne pourront pas être récupérés
        après suppression.
      </p>
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </Modal>
  );
}
