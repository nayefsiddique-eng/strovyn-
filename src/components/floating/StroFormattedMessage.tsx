'use client';

import React from 'react';
import Link from 'next/link';
import {
  parseStroRichTextBlocks,
  type StroInlineNode,
} from '@/lib/ai/stroResponseNormalizer';

export interface StroFormattedMessageProps {
  content: string;
  allowCodeBlocks?: boolean;
  onNavigate?: () => void;
}

function renderInlineNodes(
  nodes: StroInlineNode[],
  onNavigate?: () => void,
  keyPrefix = 'in'
): React.ReactNode[] {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (node.type) {
      case 'text':
        return <React.Fragment key={key}>{node.value}</React.Fragment>;
      case 'strong':
        return (
          <strong key={key} className="font-semibold text-inherit">
            {renderInlineNodes(node.children, onNavigate, `${key}-s`)}
          </strong>
        );
      case 'em':
        return (
          <em key={key} className="italic">
            {renderInlineNodes(node.children, onNavigate, `${key}-e`)}
          </em>
        );
      case 'code':
        return (
          <code
            key={key}
            className="px-1 py-0.5 bg-ivory dark:bg-[#141513] border border-warm-grey/35 dark:border-white/15 font-mono text-[11px] break-all"
          >
            {node.value}
          </code>
        );
      case 'link':
        if (node.external) {
          return (
            <a
              key={key}
              href={node.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-bronze dark:text-[#D8C29D] underline underline-offset-2 hover:opacity-85 transition-opacity break-words"
            >
              {node.label}
            </a>
          );
        }
        return (
          <Link
            key={key}
            href={node.href}
            onClick={onNavigate}
            className="font-medium text-bronze dark:text-[#D8C29D] underline underline-offset-2 hover:opacity-85 transition-opacity break-words"
          >
            {node.label}
          </Link>
        );
    }
  });
}

export const StroFormattedMessage: React.FC<StroFormattedMessageProps> = ({
  content,
  allowCodeBlocks = false,
  onNavigate,
}) => {
  const blocks = parseStroRichTextBlocks(content, { allowCodeBlocks });

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2.5 leading-[1.6] break-words [overflow-wrap:anywhere] min-w-0">
      {blocks.map((block, bIdx) => {
        switch (block.type) {
          case 'heading':
            return (
              <p
                key={`b-${bIdx}`}
                className="font-semibold text-[12.5px] tracking-tight pt-0.5 first:pt-0"
              >
                {renderInlineNodes(block.content, onNavigate, `h-${bIdx}`)}
              </p>
            );

          case 'paragraph':
            return (
              <p key={`b-${bIdx}`} className="leading-[1.6]">
                {block.lines.map((lineNodes, lIdx) => (
                  <React.Fragment key={`p-${bIdx}-${lIdx}`}>
                    {lIdx > 0 && <br />}
                    {renderInlineNodes(lineNodes, onNavigate, `pl-${bIdx}-${lIdx}`)}
                  </React.Fragment>
                ))}
              </p>
            );

          case 'unordered_list':
            return (
              <ul
                key={`b-${bIdx}`}
                className="list-disc pl-4 space-y-1.5 marker:text-bronze dark:marker:text-[#C9B28F]"
              >
                {block.items.map((itemNodes, iIdx) => (
                  <li key={`ul-${bIdx}-${iIdx}`} className="pl-0.5 leading-[1.55]">
                    {renderInlineNodes(itemNodes, onNavigate, `uli-${bIdx}-${iIdx}`)}
                  </li>
                ))}
              </ul>
            );

          case 'ordered_list':
            return (
              <ol
                key={`b-${bIdx}`}
                start={block.start}
                className="list-decimal pl-5 space-y-1.5 marker:font-mono marker:text-[11px] marker:font-semibold marker:text-bronze dark:marker:text-[#C9B28F]"
              >
                {block.items.map((itemNodes, iIdx) => (
                  <li key={`ol-${bIdx}-${iIdx}`} className="pl-0.5 leading-[1.55]">
                    {renderInlineNodes(itemNodes, onNavigate, `oli-${bIdx}-${iIdx}`)}
                  </li>
                ))}
              </ol>
            );

          case 'code_block':
            return (
              <pre
                key={`b-${bIdx}`}
                className="p-2.5 bg-ivory dark:bg-[#141513] border border-warm-grey/40 dark:border-white/15 overflow-x-auto max-w-full font-mono text-[11px] leading-relaxed"
              >
                <code>{block.code}</code>
              </pre>
            );
        }
      })}
    </div>
  );
};
