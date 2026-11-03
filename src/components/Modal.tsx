import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  children,
  close,
  locked = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  locked?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      queueMicrotask(() => {
        if (opener?.isConnected && !document.querySelector("dialog[open]"))
          opener.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) close();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close"
          disabled={locked}
          onClick={close}
        >
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
