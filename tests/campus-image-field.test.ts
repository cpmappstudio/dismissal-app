import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import ts from "typescript";
import {
  CAMPUS_IMAGE_TYPES,
  CAMPUS_IMAGE_MAX_BYTES,
  campusImageError,
} from "../lib/campus-image";

test("campus image picker validates files, previews selection, removes locally and disables actions while saving", () => {
  const file = "../components/dashboard/campus-settings/campus-image-field.tsx";
  const source = ts.createSourceFile(
    file,
    readFileSync(new URL(file, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const fn = source.statements.find(
    (s) => ts.isFunctionDeclaration(s) && s.name?.text === "CampusImageField",
  )!;
  const code = ts.transpileModule(
    fn.getText(source).replace("export function", "function") +
      "; CampusImageField;",
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const state: unknown[] = [];
  let cursor = 0;
  const effects: (() => void | (() => void))[] = [];
  const revoked: string[] = [];
  const messages = JSON.parse(
    readFileSync(new URL("../messages/en.json", import.meta.url), "utf8"),
  ).campusImage;
  const component = runInNewContext(code, {
    React,
    CAMPUS_IMAGE_TYPES,
    campusImageError,
    useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [
        state[index],
        (value: unknown) => {
          state[index] = value;
        },
      ];
    },
    useEffect: (effect: () => void | (() => void)) => effects.push(effect),
    useRef: () => ({ current: null }),
    useId: () => "image",
    useTranslations: () => (key: string) => messages[key],
    URL: {
      createObjectURL: () => "blob:preview",
      revokeObjectURL: (url: string) => revoked.push(url),
    },
    Image: "img",
    ImageIcon: "svg",
    Upload: "svg",
    X: "svg",
    Label: "label",
    ...Object.fromEntries(
      [
        "Attachment",
        "AttachmentMedia",
        "AttachmentContent",
        "AttachmentTitle",
        "AttachmentDescription",
        "AttachmentActions",
        "AttachmentAction",
        "AttachmentTrigger",
      ].map((name) => [name, name]),
    ),
  });
  let chosen: File | null | undefined;
  const props = {
    file: null as File | null,
    existingUrl: "https://example.test/current.png",
    disabled: false,
    onChange: (file: File | null) => {
      chosen = file;
    },
  };
  type Element = React.ReactElement<Record<string, unknown>>;
  const render = () => {
    cursor = 0;
    const nodes: Element[] = [];
    const visit = (node: React.ReactNode) =>
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement<Record<string, unknown>>(child)) return;
        nodes.push(child);
        visit(child.props.children as React.ReactNode);
      });
    visit(component(props));
    return nodes;
  };
  const select = (type: string, size: number) => {
    const target = {
      files: [{ name: "campus.png", type, size }],
      value: "selected",
    };
    (
      render().find((n) => n.props.type === "file")!.props.onChange as (
        event: object,
      ) => void
    )({ target });
    assert.equal(target.value, "");
  };
  select("image/svg+xml", 10);
  assert.equal(chosen, undefined);
  assert.equal(
    render().find((n) => n.props.role === "alert")?.props.children,
    messages.type,
  );
  assert.equal(
    render().find((n) => n.type === "img")?.props.src,
    props.existingUrl,
  );
  select("image/png", CAMPUS_IMAGE_MAX_BYTES + 1);
  assert.equal(
    render().find((n) => n.props.role === "alert")?.props.children,
    messages.size,
  );
  select("image/png", 10);
  assert.equal(
    render().some((n) => n.props.role === "alert"),
    false,
  );
  assert.ok(chosen);
  props.file = chosen;
  render();
  const cleanup = effects.at(-1)!();
  assert.equal(
    render().find((n) => n.type === "img")?.props.src,
    "blob:preview",
  );
  props.disabled = true;
  const busy = render();
  assert.equal(
    busy.find((n) => n.type === "Attachment")?.props.state,
    "uploading",
  );
  for (const node of busy.filter(
    (n) =>
      ["AttachmentAction", "AttachmentTrigger"].includes(String(n.type)) ||
      n.props.type === "file",
  ))
    assert.equal(node.props.disabled, true);
  props.disabled = false;
  (
    render().find((n) => n.props["aria-label"] === messages.remove)!.props
      .onClick as () => void
  )();
  assert.equal(chosen, null);
  if (cleanup) cleanup();
  assert.deepEqual(revoked, ["blob:preview"]);
});
