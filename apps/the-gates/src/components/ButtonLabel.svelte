<script lang="ts">
	let { text }: { text: string } = $props();
</script>

<!-- Stable CSS wrapping: never observe and shrink a label's own intrinsic width. -->
<span
	class="button-label"
	data-button-label={text}
	style="display:block;width:100%;min-width:0;max-width:100%;font:inherit;letter-spacing:0;line-height:1.1;color:inherit;margin:0;white-space:normal;overflow-wrap:break-word;"
	>{text}</span
>
