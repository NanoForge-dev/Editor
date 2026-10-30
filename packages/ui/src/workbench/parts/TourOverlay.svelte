<script lang="ts">
  import { untrack } from 'svelte';

  import Button from '../../components/button.svelte';
  import { findTarget } from '../tour/find-target';
  import { getWorkbenchContext } from '../workbench-context';

  /**
   * The step of the running tour: a ring around its target (clicks go through to it) and a bubble
   * with the text, Back, Next and Skip. It never traps the focus: the user acts on the editor
   * itself, and the bubble is announced as it changes.
   */
  const context = getWorkbenchContext();
  const tours = context.tours;
  const tour = tours.state;

  let rect = $state<DOMRect>();
  /** The target was looked for a while and is not on screen. */
  let missing = $state(false);
  let bubble = $state<HTMLElement>();
  let bubbleHeight = $state(0);

  $effect(() => {
    const target = $tour?.step.target;
    rect = undefined;
    missing = false;
    if (!target) return;
    const since = Date.now();
    const look = () => {
      const element = findTarget(target);
      rect = element?.getBoundingClientRect();
      missing = !element && Date.now() - since > 1500;
    };
    look();
    const timer = setInterval(look, 250);
    return () => clearInterval(timer);
  });

  /**
   * Before the bubble changes (a step's button goes) or goes, the focus leaves what is removed:
   * Chrome sends no key events after the focused element is removed, until the next click.
   */
  $effect.pre(() => {
    const shown = $tour;
    untrack(() => {
      const active = document.activeElement;
      if (!bubble || !(active instanceof HTMLElement) || !bubble.contains(active)) return;
      if (!shown) active.blur();
      else if (active !== bubble) bubble.focus({ preventScroll: true });
    });
  });
  const stop = () => tours.stop();

  const placement = $derived.by(() => {
    if (!rect) return { centered: true, top: 0, left: 0 };
    const width = Math.min(360, window.innerWidth - 32);
    const clamp = (value: number, max: number) => Math.min(Math.max(16, value), max - 16);
    const left = clamp(rect.left, window.innerWidth - width);
    if (rect.bottom + 12 + bubbleHeight < window.innerHeight)
      return { centered: false, top: rect.bottom + 12, left };
    if (rect.top - 12 - bubbleHeight > 0)
      return { centered: false, top: rect.top - 12 - bubbleHeight, left };
    /** A tall target (a whole panel): beside it, on the side with room. */
    const side = rect.left - 12 - width >= 16 ? rect.left - 12 - width : rect.right + 12;
    return {
      centered: false,
      top: clamp(rect.top, window.innerHeight - bubbleHeight),
      left: clamp(side, window.innerWidth - width),
    };
  });
</script>

{#if $tour}
  {@const { step, position, count } = $tour}
  {#if rect}
    <div
      class="ring"
      aria-hidden="true"
      style:top="{rect.top - 4}px"
      style:left="{rect.left - 4}px"
      style:width="{rect.width + 8}px"
      style:height="{rect.height + 8}px"
    ></div>
  {/if}
  <div
    bind:this={bubble}
    bind:clientHeight={bubbleHeight}
    class="bubble"
    class:centered={placement.centered}
    style:top={placement.centered ? undefined : `${placement.top}px`}
    style:left={placement.centered ? undefined : `${placement.left}px`}
    role="dialog"
    aria-modal="false"
    aria-labelledby="nf-tour-title"
    aria-describedby="nf-tour-text"
    tabindex="-1"
    onkeydown={(event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        stop();
      }
    }}
  >
    <p class="progress">{$tour.tour.title} · {position} of {count}</p>
    <h2 id="nf-tour-title" aria-live="polite">{step.title}</h2>
    <p id="nf-tour-text">{step.text}</p>
    {#if missing && step.target}
      <p class="missing">
        "{step.target.name}" is not on screen right now: {step.action
          ? `use ${step.action.title}, or go on with Next.`
          : 'go on with Next.'}
      </p>
    {/if}
    <div class="actions">
      <Button size="sm" variant="ghost" onclick={stop}>Skip tour</Button>
      <span class="grow"></span>
      {#if step.action}
        <Button size="sm" onclick={() => void tours.act()}>{step.action.title}</Button>
      {/if}
      <Button size="sm" disabled={position <= 1} onclick={() => tours.back()}>Back</Button>
      <Button
        size="sm"
        variant="primary"
        onclick={() => {
          if (position >= count) stop();
          else tours.next();
        }}>{position >= count ? 'Done' : 'Next'}</Button
      >
    </div>
  </div>
{/if}

<style>
  .ring {
    position: fixed;
    z-index: 2400;
    border: 2px solid var(--nf-color-accent);
    border-radius: var(--nf-radius-control);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--nf-color-accent) 30%, transparent);
    pointer-events: none;
    transition:
      top var(--nf-motion-fast),
      left var(--nf-motion-fast),
      width var(--nf-motion-fast),
      height var(--nf-motion-fast);
  }
  .bubble {
    position: fixed;
    z-index: 2400;
    width: min(360px, calc(100vw - 32px));
    padding: var(--nf-space-3);
    border: 1px solid var(--nf-color-border-strong);
    border-radius: var(--nf-radius-panel, 6px);
    background: var(--nf-color-raised);
    box-shadow: var(--nf-shadow-popover, 0 8px 24px rgb(0 0 0 / 30%));
  }
  .bubble.centered {
    top: 50%;
    left: 50%;
    translate: -50% -50%;
  }
  .progress {
    margin: 0;
    color: var(--nf-color-text-muted);
    font-size: var(--nf-font-size-sm);
  }
  h2 {
    margin: var(--nf-space-1) 0;
    font-size: var(--nf-font-size-lg, 15px);
  }
  p {
    margin: 0 0 var(--nf-space-2);
  }
  .missing {
    color: var(--nf-color-warning);
  }
  .actions {
    display: flex;
    gap: var(--nf-space-2);
    align-items: center;
  }
  .grow {
    flex: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .ring {
      transition: none;
    }
  }
</style>
