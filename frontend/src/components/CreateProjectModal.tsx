import { useEffect, useRef, useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string) => Promise<void>;
}

export default function CreateProjectModal({ open, onClose, onCreate }: CreateProjectModalProps) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Le titre est obligatoire.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate(trimmed);
      onClose();
    } catch (e: any) {
      setError(e.message || "Échec de la création.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouveau projet"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Création…" : "Créer"}
          </Button>
        </>
      }
    >
      <Input
        ref={inputRef}
        label="Titre du projet"
        placeholder="Ex. Réconciliation MoMo Avril"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </Modal>
  );
}
