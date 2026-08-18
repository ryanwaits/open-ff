import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const WINDOW = 5;

export function TablePager({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = pageWindow(page, pageCount);

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-mono text-[11px] tracking-wide text-faint">
        {from}–{to} of {total}
      </p>
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <PageBtn label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="size-4" strokeWidth={2.2} />
          </PageBtn>
          {pages[0] > 1 ? (
            <>
              <PageBtn label="Page 1" onClick={() => onPage(1)} active={page === 1}>
                1
              </PageBtn>
              {pages[0] > 2 ? <Ellipsis /> : null}
            </>
          ) : null}
          {pages.map((n) => (
            <PageBtn key={n} label={`Page ${n}`} active={n === page} onClick={() => onPage(n)}>
              {n}
            </PageBtn>
          ))}
          {pages[pages.length - 1] < pageCount ? (
            <>
              {pages[pages.length - 1] < pageCount - 1 ? <Ellipsis /> : null}
              <PageBtn
                label={`Page ${pageCount}`}
                active={page === pageCount}
                onClick={() => onPage(pageCount)}
              >
                {pageCount}
              </PageBtn>
            </>
          ) : null}
          <PageBtn label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
            <ChevronRight className="size-4" strokeWidth={2.2} />
          </PageBtn>
        </nav>
      ) : null}
    </div>
  );
}

function pageWindow(page: number, pageCount: number): number[] {
  if (pageCount <= WINDOW) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const half = Math.floor(WINDOW / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(pageCount, start + WINDOW - 1);
  start = Math.max(1, end - WINDOW + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function PageBtn({
  children,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-sm font-mono text-xs",
        active ? "bg-accent text-accent-fg" : "text-muted hover:bg-raised hover:text-fg",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function Ellipsis() {
  return (
    <span aria-hidden="true" className="px-1 font-mono text-xs text-faint">
      …
    </span>
  );
}
