"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AtSign,
  Bell,
  Calendar,
  Check,
  CheckCheck,
  FileText,
  Inbox,
  MessageSquare,
  MoreHorizontal,
  PencilLine,
  Settings2,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/* ------------------------------------------------------ inlined from lib --
 *  Inlined by scripts/build-shapes.mjs so this file stands alone.
 *  Edit src/lib/ and rebuild — changes made here are overwritten.
 * ------------------------------------------------------------------------ */

/**
 * The interface face: whatever the theme sets as `--font-sans` (Layro's theme
 * sets Inter; a shadcn project keeps its own), then Inter, then the system
 * stack. The components never fetch a font.
 */
const FONT_STACK =
  'var(--font-sans, "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif)';

/**
 * Squircle corners — continuous curvature rather than a circular arc, the way
 * iOS and Figma draw them. Progressive: browsers without `corner-shape` fall
 * back to the plain rounded corner the radius already specifies.
 */
const SQUIRCLE = "[corner-shape:squircle]";

/**
 * A hairline inset ring. Used instead of `border` so the edge never changes an
 * element's box size, which keeps rows from shifting by a pixel on hover.
 */
const EDGE = "ring-1 ring-inset ring-border";

/**
 * The default spring. Quick and slightly tight — it settles without a visible
 * bounce, which is what you want for anything that appears under the cursor.
 */
const SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.8,
} as const;

/**
 * The softer spring, for larger surfaces where the default reads as abrupt:
 * panels sliding in, height changes, anything crossing more than ~200px.
 */
const SOFT = { type: "spring", stiffness: 300, damping: 30 } as const;

/**
 * Join class names, and let a later Tailwind class win over an earlier one.
 *
 * The same `cn` shadcn/ui ships in `lib/utils`, so a buyer's `className`
 * override does what they expect: `<Button className="h-11" />` replaces the
 * button's own height rather than fighting it in the cascade.
 *
 * Extended with the Layro type scale — without it, `text-title` would be read
 * as a colour and silently dropped next to `text-foreground`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["figure", "title", "body", "sub", "dense", "meta", "chip", "micro"] }],
      shadow: [{ shadow: ["float", "overlay"] }],
    },
  },
});

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


/* ==========================================================================
   NotificationPanel

   The list you open when the bell has a dot on it. Everything here follows
   from one observation: a notification is a sentence, and the reason these
   panels turn to soup is that the sentence gets buried under chrome.

   So the row is built around the sentence. The actor's name and the thing
   they touched are the only emphasised words; the verb stays quiet, and the
   time and the place it happened sit underneath in one dim line. The little
   badge on the avatar says what kind of event it was, which is what lets the
   eye skip a whole class of rows without reading any of them.

   Three behaviours earn their place:

   Actions resolve in place. A request row that offers Approve and Deny does
   not vanish when you answer — vanishing is how people lose track of what
   they just did. It settles into a quiet line that says which way you went,
   so the panel still reads as a history.

   Repeats collapse. Six edits to the same file by the same person is one
   row with a count, not six rows; that is the difference between a list you
   scan and a list you abandon.

   Archiving is a move, not a delete. Rows leave the inbox with a spring and
   land in Archived, and the row's menu can send them back.
   ========================================================================== */


/* -------------------------------------------------------------------------- */

export type NotificationKind =
  | "mention"
  | "comment"
  | "edit"
  | "file"
  | "request"
  | "join"
  | "created"
  | "due";

/** A sentence is plain strings plus the words worth emphasising. */
export type NotificationPiece = string | { entity: string };

export type NotificationAction = {
  id: string;
  label: string;
  tone?: "primary" | "quiet";
  /** What the row says once this action has been taken. */
  resolved?: string;
};

export type NotificationItem = {
  id: string;
  actor: { name: string; avatar?: string };
  kind: NotificationKind;
  /** The sentence after the actor's name. */
  body: NotificationPiece[];
  time: string;
  /** Where it happened — rendered as a dim breadcrumb. */
  context?: string[];
  unread?: boolean;
  archived?: boolean;
  /** Shows in the Following tab. */
  following?: boolean;
  /** Repeats folded into this row, counting this one. */
  count?: number;
  /** An excerpt of the comment that triggered it. */
  quote?: string;
  attachment?: { name: string; size?: string; type?: string };
  actions?: NotificationAction[];
};

export type NotificationPanelProps = {
  items: NotificationItem[];
  /** Called with the row and the action taken. */
  onAction?: (item: NotificationItem, actionId: string) => void;
  onOpenItem?: (item: NotificationItem) => void;
  onReadChange?: (item: NotificationItem, unread: boolean) => void;
  onArchiveChange?: (item: NotificationItem, archived: boolean) => void;
  onMarkAllRead?: () => void;
  onSettings?: () => void;
  /** Height of the scrolling list. */
  maxHeight?: number;
  className?: string;
};

/* -------------------------------------------------------------------------- */

const KIND_ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  mention: AtSign,
  comment: MessageSquare,
  edit: PencilLine,
  file: FileText,
  request: Sparkles,
  join: UserPlus,
  created: Sparkles,
  due: Calendar,
};

/* Badge tints, kept to the same families the rest of the set uses. */
const KIND_TINT: Record<NotificationKind, string> = {
  mention: "bg-violet-500 text-white",
  comment: "bg-info text-info-foreground",
  edit: "bg-primary/80 text-primary-foreground",
  file: "bg-teal-500 text-white",
  request: "bg-warning-fill text-warning-foreground",
  join: "bg-success text-success-foreground",
  created: "bg-violet-500 text-white",
  due: "bg-rose-500 text-white",
};

const TINTS = [
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-info/15 text-info",
  "bg-success/15 text-success",
  "bg-warning/15 text-warning",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200",
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

function Avatar({ item }: { item: NotificationItem }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <span className="relative block h-8 w-8 shrink-0">
      {item.actor.avatar ? (
        // an avatar URL from any host, 32px: next/image would need each host allow-listed
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.actor.avatar}
          alt=""
          draggable={false}
          className={cn("h-8 w-8 rounded-full object-cover", EDGE)}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold",
            EDGE,
            tintFor(item.actor.name),
          )}
        >
          {initials(item.actor.name)}
        </span>
      )}
      {/* what kind of event this was, readable without reading the sentence */}
      <span
        aria-hidden
        className={cn(
          "absolute -right-0.5 -bottom-0.5 grid h-[15px] w-[15px] place-items-center rounded-full ring-2 ring-card",
          KIND_TINT[item.kind],
        )}
      >
        <Icon className="h-[9px] w-[9px]" />
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */

const MENU_W = 176;
const MENU_GAP = 6;

/**
 * The row menu.
 *
 * It renders in a portal rather than inside the row, because the list
 * scrolls: a menu on the last row would otherwise be cut off by the panel's
 * own overflow. Being in a portal means it has to be positioned against the
 * viewport by hand, and flipped above the trigger when the space below runs
 * out — and it has to carry the font with it, since it no longer inherits
 * anything from the panel.
 */
function RowMenu({
  unread,
  archived,
  onRead,
  onArchive,
}: {
  unread: boolean;
  archived: boolean;
  onRead: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [box, setBox] = React.useState({ top: 0, left: 0, above: false });
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  /** The scrolling ancestor the trigger lives in, so we can tell when it leaves. */
  const scroller = React.useCallback(() => {
    let el = triggerRef.current?.parentElement ?? null;
    while (el) {
      const o = getComputedStyle(el).overflowY;
      if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return null;
  }, []);

  const place = React.useCallback(() => {
    const trigger = triggerRef.current;
    /* Trigger gone (its row was filtered away) — nothing left to point at. */
    if (!trigger) {
      setOpen(false);
      return;
    }
    const r = trigger.getBoundingClientRect();

    /* If the row has scrolled out of the list, the menu would be left
       floating on its own — close it instead of chasing a hidden trigger. */
    const listBox = scroller()?.getBoundingClientRect();
    if (listBox && (r.bottom < listBox.top + 4 || r.top > listBox.bottom - 4)) {
      setOpen(false);
      return;
    }

    const height = menuRef.current?.offsetHeight ?? 76;

    /* The menu should stay over the panel it belongs to. A row at the bottom
       of the list has room below it in the viewport but not on the surface,
       and a menu hanging off the panel's edge reads as detached from it — so
       the panel's own bounds decide the flip, and the viewport only clamps. */
    const panel = trigger.closest("[data-notification-panel]")?.getBoundingClientRect();
    const lowest = Math.min(panel?.bottom ?? window.innerHeight, window.innerHeight - 8);
    const highest = Math.max(panel?.top ?? 0, 8);

    const fitsBelow = r.bottom + MENU_GAP + height <= lowest;
    const fitsAbove = r.top - MENU_GAP - height >= highest;
    const above = !fitsBelow && fitsAbove;

    let top = above ? r.top - MENU_GAP - height : r.bottom + MENU_GAP;
    if (!fitsBelow && !fitsAbove) top = Math.max(highest, lowest - height);
    top = Math.min(Math.max(top, 8), Math.max(8, window.innerHeight - height - 8));

    setBox({
      top,
      left: Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)),
      above,
    });
  }, [scroller]);

  React.useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const move = () => place();
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", move, true);
    window.addEventListener("resize", move);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", move, true);
      window.removeEventListener("resize", move);
    };
  }, [open, place]);

  const item =
    "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] text-foreground/90 transition-colors hover:bg-accent";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Row options"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          "grid h-6 w-6 place-items-center rounded-[7px] transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          SQUIRCLE,
          /* Visible at rest, not only on hover — a control you cannot see is
             a control people never find. */
          open
            ? "bg-muted text-foreground"
            : "text-muted-foreground opacity-70 group-hover/row:opacity-100 focus-visible:opacity-100",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                ref={menuRef}
                role="menu"
                /* The menu lives in a portal, so a pointerdown inside it would
                   look like an outside click to whatever opened the panel.
                   Keep it from reaching document-level listeners. */
                onPointerDown={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.98, y: box.above ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: box.above ? 4 : -4 }}
                transition={SOFT}
                style={{
                  position: "fixed",
                  top: box.top,
                  left: box.left,
                  width: MENU_W,
                  fontFamily: FONT_STACK,
                }}
                className={cn(
                  "z-[70] rounded-[12px] border border-border/60 bg-card p-1 shadow-[0_16px_36px_-14px_rgb(0_0_0/0.28)]",
                  box.above ? "origin-bottom-right" : "origin-top-right",
                  SQUIRCLE,
                )}
              >
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={(e) => {
                e.stopPropagation();
                onRead();
                setOpen(false);
              }}
            >
              <Check className="h-3.5 w-3.5 text-muted-foreground/75" />
              {unread ? "Mark as read" : "Mark as unread"}
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
                setOpen(false);
              }}
            >
              <Inbox className="h-3.5 w-3.5 text-muted-foreground/75" />
                    {archived ? "Move to inbox" : "Archive"}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Sentence({ actor, body }: { actor: string; body: NotificationPiece[] }) {
  return (
    <p className="m-0 text-[13px] leading-[1.45] text-foreground/75">
      <span className="font-medium text-foreground">{actor}</span>{""}
      {body.map((piece, i) =>
        typeof piece === "string" ? (
          <React.Fragment key={i}>{piece}</React.Fragment>
        ) : (
          <span key={i} className="font-medium text-foreground">
            {piece.entity}
          </span>
        ),
      )}
    </p>
  );
}

function Row({
  item,
  resolved,
  onAction,
  onOpen,
  onRead,
  onArchive,
}: {
  item: NotificationItem;
  resolved?: string;
  onAction: (actionId: string) => void;
  onOpen: () => void;
  onRead: () => void;
  onArchive: () => void;
}) {
  const ext = item.attachment?.type ?? item.attachment?.name.split(".").pop()?.slice(0, 4);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group/row relative flex w-full cursor-default gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none",
        item.unread
          ? "bg-muted/50 hover:bg-muted/70"
          : "hover:bg-accent",
      )}
    >
      <Avatar item={item} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Sentence actor={item.actor.name} body={item.body} />

            {/* time, place, and how many times it happened */}
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-muted-foreground">
              <span>{item.time}</span>
              {item.context?.length ? (
                <>
                  <span aria-hidden className="text-muted-foreground/50">
                    ·
                  </span>
                  <span className="truncate">{item.context.join(" / ")}</span>
                </>
              ) : null}
              {item.count && item.count > 1 ? (
                <span
                  className={cn(
                    "ml-0.5 rounded-full bg-muted px-1.5 py-px text-[10.5px] font-medium text-foreground/75",
                  )}
                >
                  {item.count} updates
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <RowMenu
              unread={!!item.unread}
              archived={!!item.archived}
              onRead={onRead}
              onArchive={onArchive}
            />
            {item.unread ? (
              <span
                aria-label="Unread"
                className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-info"
              />
            ) : (
              <span className="h-[7px] w-[7px] shrink-0" />
            )}
          </div>
        </div>

        {item.quote ? (
          <p
            className={cn(
              "m-0 mt-2 rounded-[10px] bg-foreground/5 px-2.5 py-1.5 text-[12.5px] leading-[1.5] text-foreground/75",
              SQUIRCLE,
            )}
          >
            “{item.quote}”
          </p>
        ) : null}

        {item.attachment ? (
          <div
            className={cn(
              "mt-2 flex w-fit max-w-full items-center gap-2 rounded-[10px] border border-border/60 px-2 py-1.5",
              SQUIRCLE,
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-[7px] bg-muted text-[9.5px] font-semibold tracking-[0.02em] text-muted-foreground uppercase",
                SQUIRCLE,
              )}
            >
              {ext || <FileText className="h-3 w-3" />}
            </span>
            <span className="truncate text-[12.5px] text-foreground/90">
              {item.attachment.name}
            </span>
            {item.attachment.size ? (
              <span className="shrink-0 text-[11.5px] text-muted-foreground/75">
                {item.attachment.size}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* an answered request keeps its place in the history */}
        {resolved ? (
          <p className="m-0 mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-success"strokeWidth={2.75} />
            {resolved}
          </p>
        ) : item.actions?.length ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {item.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(action.id);
                }}
                className={cn(
                  "inline-flex h-8 items-center rounded-[9px] px-3 text-[12.5px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                  SQUIRCLE,
                  action.tone === "primary"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border/85 text-foreground/90 hover:bg-accent",
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type TabId = "inbox" | "following" | "all" | "archived";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "inbox", label: "Inbox" },
  { id: "following", label: "Following" },
  { id: "archived", label: "Archived" },
];

export const NotificationPanel = React.forwardRef<HTMLDivElement, NotificationPanelProps>(
  function NotificationPanel(
    {
      items,
      onAction,
      onOpenItem,
      onReadChange,
      onArchiveChange,
      onMarkAllRead,
      onSettings,
      maxHeight = 420,
      className,
    },
    ref,
  ) {
    const reduced = useReducedMotion();
    const [tab, setTab] = React.useState<TabId>("all");
    const [state, setState] = React.useState(items);
    const [resolved, setResolved] = React.useState<Record<string, string>>({});

    const [prevItems, setPrevItems] = React.useState(items);
    if (items !== prevItems) {
      setPrevItems(items);
      setState(items);
    }

    const patch = (id: string, next: Partial<NotificationItem>) =>
      setState((list) => list.map((n) => (n.id === id ? { ...n, ...next } : n)));

    const shown = React.useMemo(() => {
      switch (tab) {
        /* Inbox is what still wants something from you. */
        case "inbox":
          return state.filter((n) => !n.archived && (n.unread || n.actions?.length));
        case "following":
          return state.filter((n) => n.following && !n.archived);
        case "archived":
          return state.filter((n) => n.archived);
        /* All is the whole feed, minus what you filed away. */
        default:
          return state.filter((n) => !n.archived);
      }
    }, [state, tab]);

    const unread = state.filter((n) => n.unread && !n.archived).length;
    const counts: Record<TabId, number> = {
      inbox: unread,
      following: state.filter((n) => n.following && n.unread && !n.archived).length,
      all: 0,
      archived: 0,
    };

    return (
      <div
        ref={ref}
        data-notification-panel=""
        style={{ fontFamily: FONT_STACK }}
        className={cn(
          "w-full max-w-[440px] overflow-hidden rounded-[18px] border border-border/60 bg-card text-foreground antialiased",
          SQUIRCLE,
          className,
        )}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-0.5">
          <h2 className="m-0 text-[15px] font-semibold tracking-[-0.01em]">Notifications</h2>
          <button
            type="button"
            onClick={() => {
              setState((list) => list.map((n) => ({ ...n, unread: false })));
              onMarkAllRead?.();
            }}
            disabled={unread === 0}
            className="inline-flex items-center gap-1.5 rounded-[8px] px-1.5 py-1 text-[12.5px] font-medium text-foreground/75 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </button>
        </div>

        {/* tabs */}
        <div className="flex items-center gap-1 border-b border-border/50 px-3">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative shrink-0 px-2 py-2.5 text-[13px] font-medium transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {t.label}
                    {counts[t.id] > 0 ? (
                      <span className="rounded-full bg-info px-1.5 py-px text-[10.5px] font-semibold text-info-foreground">
                        {counts[t.id]}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <motion.span
                      layoutId="notif-tab"
                      transition={reduced ? { duration: 0 } : SPRING}
                      className="absolute inset-x-1.5 -bottom-px h-[3px] rounded-full bg-primary"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Notification settings"
            onClick={onSettings}
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-muted-foreground/75 transition-colors hover:bg-accent hover:text-foreground/90",
              SQUIRCLE,
            )}
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        {/* list */}
        <div
          style={{ maxHeight }}
          className="divide-y divide-border/40 overflow-y-auto [scrollbar-width:thin]"
        >
          <AnimatePresence initial={false}>
            {shown.map((item) => (
              <motion.div
                key={item.id}
                layout={!reduced}
                initial={false}
                exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.18 } }}
                transition={SPRING}
              >
                <Row
                  item={item}
                  resolved={resolved[item.id]}
                  onOpen={() => {
                    if (item.unread) {
                      patch(item.id, { unread: false });
                      onReadChange?.(item, false);
                    }
                    onOpenItem?.(item);
                  }}
                  onRead={() => {
                    patch(item.id, { unread: !item.unread });
                    onReadChange?.(item, !item.unread);
                  }}
                  onArchive={() => {
                    patch(item.id, { archived: !item.archived, unread: false });
                    onArchiveChange?.(item, !item.archived);
                  }}
                  onAction={(actionId) => {
                    const action = item.actions?.find((a) => a.id === actionId);
                    setResolved((r) => ({
                      ...r,
                      [item.id]: action?.resolved ?? `You chose ${action?.label ?? actionId}`,
                    }));
                    patch(item.id, { unread: false });
                    onAction?.(item, actionId);
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <span
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-[12px] bg-muted text-muted-foreground/75",
                  SQUIRCLE,
                )}
              >
                <Bell className="h-[18px] w-[18px]" />
              </span>
              <p className="m-0 text-[13px] font-medium text-foreground/90">
                {tab === "archived" ? "Nothing archived" : "You are all caught up"}
              </p>
              <p className="m-0 text-[12.5px] text-muted-foreground">
                {tab === "archived"
                  ? "Rows you archive land here."
                  : "New activity will show up here."}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);

export default NotificationPanel;
