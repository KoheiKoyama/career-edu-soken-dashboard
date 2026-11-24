"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "@/app/actions";

type Props = {
  action: (fd: FormData) => Promise<ActionResult | void>;
  children: ReactNode;
  className?: string;
  /** 成功したらフォームを空に戻す（新規作成フォーム用） */
  resetOnSuccess?: boolean;
  /** 送信前に確認ダイアログを出す */
  confirm?: string;
};

/** サーバーアクションを呼び、エラーがあればフォームの下に表示する */
export function ActionForm({ action, children, className, resetOnSuccess, confirm }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await action(fd);
          if (r && r.error) {
            setError(r.error);
            return;
          }
          setError(null);
          if (resetOnSuccess) ref.current?.reset();
          const details = ref.current?.closest("details");
          if (details) details.open = false;
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}

/** select を変えた瞬間に送信する（パイプラインのステージ変更用） */
export function AutoSubmitSelect({
  action,
  name,
  defaultValue,
  options,
  className,
}: {
  action: (fd: FormData) => Promise<ActionResult | void>;
  name: string;
  defaultValue: string;
  options: readonly string[];
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <select
        name={name}
        defaultValue={defaultValue}
        disabled={pending}
        className={className}
        onChange={(e) => {
          const fd = new FormData();
          fd.set(name, e.target.value);
          start(async () => {
            const r = await action(fd);
            setError(r && r.error ? r.error : null);
          });
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
