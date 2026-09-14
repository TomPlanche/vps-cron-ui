<script lang="ts">
  import type { Outcome } from "$lib/api";
  import { OUTCOME_COLORS } from "$lib/format";
  import { TextMorph } from "torph/svelte";

  import Tag from "$lib/components/Tag.svelte";

  type Props = { outcome: Outcome };

  let { outcome }: Props = $props();
</script>

<Tag color={OUTCOME_COLORS[outcome]}>
  <TextMorph text={outcome} />
</Tag>
