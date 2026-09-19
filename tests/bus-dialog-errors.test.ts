import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import ts from "typescript";
import { ConvexError } from "convex/values";

for (const locale of ["en", "es"]) {
  test(`bus form explains campus assignment conflicts in ${locale} and preserves edits`, async () => {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    const file = "../components/dashboard/buses/bus-dialog.tsx";
    const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
    const fn = source.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === "BusForm")!;
    const code = ts.transpileModule(`${fn.getText(source)}; BusForm;`, {
      compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const state: unknown[] = [];
    let cursor = 0;
    let failure: unknown = new ConvexError({ code: "CAMPUS_HAS_ASSIGNED_STUDENTS" });
    let saved = false;
    const component = runInNewContext(code, {
      React, ConvexError,
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value: unknown) => { state[index] = value; }];
      },
      useTranslations: (namespace: string) => (key: string) => messages[namespace][key],
      useQuery: () => [{ _id: "campus", campusName: "School", isActive: true }],
      useMutation: () => async () => { if (failure) throw failure; return "bus"; },
      api: { campus: { getAll: "campuses" }, buses: { save: "save" } },
      Input: "input", Label: "label", Button: "button",
    });
    type Element = React.ReactElement<Record<string, unknown>>;
    const render = () => {
      cursor = 0;
      const nodes: Element[] = [];
      const visit = (node: React.ReactNode) => React.Children.forEach(node, child => {
        if (!React.isValidElement<Record<string, unknown>>(child)) return;
        nodes.push(child); visit(child.props.children as React.ReactNode);
      });
      visit(component({ bus: { _id: "bus", name: "My bus", identifier: 123, campusIds: ["campus"], updatedAt: 1 }, onSaved: () => { saved = true; } }));
      return nodes;
    };
    const submit = () => (render().find(n => n.type === "form")!.props.onSubmit as (e: object) => Promise<void>)({ preventDefault() {} });
    await submit();
    assert.equal(render().find(n => n.props.role === "alert")!.props.children, messages.buses.campusHasAssignedStudents);
    assert.equal(render().find(n => n.props.id === "bus-name")!.props.value, "My bus");
    assert.equal(render().find(n => n.props.type === "submit")!.props.disabled, false);
    assert.equal(saved, false);
    failure = new Error("[CONVEX M(buses:save)] Server Error: internal details");
    await submit();
    assert.equal(render().find(n => n.props.role === "alert")!.props.children, messages.transport.saveError);
    failure = null;
    await submit();
    assert.equal(render().some(n => n.props.role === "alert"), false);
    assert.equal(saved, true);
  });
}
