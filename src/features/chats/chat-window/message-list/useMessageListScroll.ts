import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Message } from '../../store/types';

// Within this distance from the bottom, a new message keeps the list pinned.
const STICK_TO_BOTTOM_PX = 120;

/**
 * Where a conversation is scrolled to. It opens on the unread bar if there is
 * one (otherwise at the end) and then follows the end for as long as the
 * reader is there. Someone reading older messages is left alone, except that
 * sending a message brings them back down.
 */
export const useMessageListScroll = (messages: Message[]) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const unreadBarRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const knownCountRef = useRef(messages.length);
  const hasMessages = messages.length > 0;

  // On opening, bring the unread bar to the top (the end of the list stops it
  // when there is little below), as MAX does; without one, start at the end.
  // Its own effect, and idempotent: StrictMode runs it twice.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const bar = unreadBarRef.current;
    if (!bar) {
      scroller.scrollTop = scroller.scrollHeight;
      return;
    }
    scroller.scrollTop =
      bar.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    pinnedRef.current =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <
      STICK_TO_BOTTOM_PX;
  }, []);

  // Follow the end while pinned: a message arrives, a status adds a line under
  // a bubble, the list grows.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const added = messages.length > knownCountRef.current;
    knownCountRef.current = messages.length;
    if (added && messages.at(-1)?.direction === 'outgoing') {
      pinnedRef.current = true;
    }
    if (pinnedRef.current) scroller.scrollTop = scroller.scrollHeight;
  }, [messages]);

  // The same when the room changes without the messages changing: the composer
  // grows, the window is resized, the on-screen keyboard opens.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(scroller);
    if (scroller.firstElementChild) {
      observer.observe(scroller.firstElementChild);
    }
    return () => observer.disconnect();
  }, [hasMessages]);

  const handleScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    pinnedRef.current =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <
      STICK_TO_BOTTOM_PX;
  };

  return { scrollRef, unreadBarRef, handleScroll };
};
