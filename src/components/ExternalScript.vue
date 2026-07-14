<script>
import { h } from "vue";

export default {
  name: "ExternalScript",
  inheritAttrs: false,
  props: {
    src: { type: String, required: true },
    async: { type: Boolean, default: true },
  },
  emits: ["load", "error"],
  setup(props, { emit }) {
    return () => h("script", {
      src: props.src,
      async: props.async,
      onLoad: (event) => emit("load", event),
      onError: (event) => emit("error", event),
    });
  },
};
</script>
