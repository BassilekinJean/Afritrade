import { useEffect, useRef, useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";

interface RenameProjectModalProps {
  open: boolean;
  currentTitle: string;
  onClose: () => void;
  onRename: (title: string) => Promise<void>;
}

export default function RenameProjectModal({
  open,
  currentTitle,
  onClose,
  onRename,
}: RenameProjectModalProps) {
  const [title, setTitle] = useState(currentTitle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(currentTitle);
      setError(null);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [open, currentTitle]);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Le titre est obligatoire.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onRename(trimmed);
      onClose();
    } catch (e: any) {
      setError(e.message || "Échec du renommage.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Renommer le projet"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Enregistrement…" : "Renommer"}
          </Button>
        </>
      }
    >
      <Input
        ref={inputRef}
        label="Titre du projet"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </Modal>
  );
}
