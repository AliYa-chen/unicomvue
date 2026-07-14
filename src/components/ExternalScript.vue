<script>
import { defineComponent, h } from "vue";

export default defineComponent({
  name: "ExternalScript",
  inheritAttrs: false,
  props: {
    src: { type: String, required: true },
    async: { type: Boolean, default: true },
  },
  emits: ["load", "error"],
  setup(props, { attrs, emit }) {
    return () => h("script", {
      ...attrs,
      src: props.src,
      async: props.async,
      onLoad: (event) => emit("load", event),
      onError: (event) => emit("error", event),
    });
  },
});
</script>
