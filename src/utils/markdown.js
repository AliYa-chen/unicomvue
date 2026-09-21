export function extractMarkdownTitle(source, fallbackTitle) {
  const heading = String(source).match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || fallbackTitle;
}

export function renderMarkdownSections(source, MarkdownIt, fallbackTitle) {
  const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
  });
  const defaultLinkOpen = markdown.renderer.rules.link_open
    || ((tokens, index, options, _environment, renderer) => (
      renderer.renderToken(tokens, index, options)
    ));

  markdown.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
    const href = tokens[index].attrGet("href") || "";
    if (/^https?:\/\//i.test(href)) {
      tokens[index].attrSet("target", "_blank");
      tokens[index].attrSet("rel", "noopener noreferrer");
    }
    return defaultLinkOpen(tokens, index, options, environment, renderer);
  };

  const environment = {};
  const tokens = markdown.parse(source, environment);
  const titleIndex = tokens.findIndex(
    (token) => token.type === "heading_open" && token.tag === "h1",
  );
  const title = titleIndex >= 0 && tokens[titleIndex + 1]?.type === "inline"
    ? tokens[titleIndex + 1].content.trim()
    : fallbackTitle;

  if (titleIndex >= 0) tokens.splice(titleIndex, 3);

  const sections = [];
  let sectionTitle = "";
  let sectionTokens = [];

  function appendSection() {
    if (!sectionTokens.length) return;
    sections.push(Object.freeze({
      title: sectionTitle,
      html: markdown.renderer.render(sectionTokens, markdown.options, environment),
    }));
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "heading_open" && token.tag === "h2") {
      appendSection();
      sectionTitle = tokens[index + 1]?.type === "inline"
        ? tokens[index + 1].content.trim()
        : "";
      sectionTokens = [];
      index += 2;
      continue;
    }
    sectionTokens.push(token);
  }
  appendSection();

  return Object.freeze({
    title,
    sections: Object.freeze(sections),
  });
}
