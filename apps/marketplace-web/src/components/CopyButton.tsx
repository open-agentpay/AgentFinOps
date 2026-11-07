'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

export function CopyButton({
  text,
  label,
  copiedLabel,
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const defaultLabel = '复制代码';
  const defaultCopiedLabel = '已复制';

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
        copied
          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
          : 'border-slate-700/80 bg-slate-800/80 text-slate-300 hover:border-indigo-500/50 hover:bg-slate-800 hover:text-white'
      } ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span>{copiedLabel || defaultCopiedLabel}</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-slate-400" />
          <span>{label || defaultLabel}</span>
        </>
      )}
    </button>
  );
}
