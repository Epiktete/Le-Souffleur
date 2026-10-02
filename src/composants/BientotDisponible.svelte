<script lang="ts">
  import { t } from '../textes';
  let { titre }: { titre: string } = $props();
</script>

<section class="pause boite">
  <h2>{titre} — {t.bientot.badge}</h2>
  <p>{t.bientot.message}</p>
  <a href="#/banque">{t.bientot.retour}</a>
</section>

<style>
  .pause {
    margin: 16px;
    padding: 24px;
    align-self: start;
    background: repeating-linear-gradient(135deg, transparent 0 7px, rgb(107 107 107 / 0.08) 7px 9px), #e8e8e8;
    color: var(--encre2);
  }
  h2 { font-size: 18px; }
</style>
