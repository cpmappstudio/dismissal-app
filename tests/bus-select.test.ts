import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Exercise the real component's props/callback without mounting Radix's DOM.
test("reopening a bus selector preserves its saved assignment through async option synchronization", () => {
  const file = "../components/dashboard/buses/bus-select.tsx";
  const source = ts.createSourceFile(
    file,
    readFileSync(new URL(file, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const component = source.statements.find(ts.isFunctionDeclaration)!;
  const { outputText } = ts.transpileModule(
    component.getText(source).replace("export ", "") + "\nBusSelect;",
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  type Element = {
    type: string;
    props: Record<string, unknown>;
    children: Element[];
  };
  type Props = {
    buses?: { identifier: number | string; name: string }[];
    value: string;
    onChange(value: string): void;
  };
  const render = runInNewContext(outputText, {
    useTranslations: () => (key: string) => key,
    React: {
      createElement: (
        type: string,
        props: Element["props"],
        ...children: Element[]
      ) => ({ type, props, children }),
    },
    ...Object.fromEntries(
      [
        "Select",
        "SelectContent",
        "SelectItem",
        "SelectTrigger",
        "SelectValue",
      ].map((name) => [name, name]),
    ),
  }) as (props: Props) => Element;

  for (const saved of ["123", "ABC-123"]) {
    let value = saved;
    const changes: string[] = [];
    const onChange = (next: string) => {
      value = next;
      changes.push(next);
    };
    const buses = [
      { identifier: saved === "123" ? 123 : saved, name: "School bus" },
      { identifier: 456, name: "Other bus" },
    ];
    for (const options of [undefined, buses, undefined, buses]) {
      const select = render({ buses: options, value, onChange }).children[0];
      assert.equal(select.props.value, options ? saved : "");
      // Native synchronization is not a user request to remove the assignment.
      (select.props.onValueChange as (value: string) => void)("");
      assert.equal(value, saved);
    }
    assert.deepEqual(changes, []);
    const select = render({ buses, value, onChange }).children[0];
    (select.props.onValueChange as (value: string) => void)("456");
    assert.equal(value, "456");
    assert.equal(
      render({ buses, value, onChange }).children[0].props.value,
      "456",
    );
    assert.deepEqual(changes, ["456"]);
  }
});
