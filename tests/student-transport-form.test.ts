import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import ts from "typescript";
import { normalizeVehicleIdentifier } from "../lib/vehicle";

test("student form edits and clears the bus without clearing the car, and submits both", async () => {
  const file = "../components/dashboard/students-table/student-form-dialog.tsx";
  const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const fn = source.statements.find(ts.isFunctionDeclaration)!;
  const code = ts.transpileModule(fn.getText(source).replace("export ", "") + ";StudentFormDialog;", {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const state: unknown[] = [];
  let cursor = 0;
  const imports = source.statements.filter(ts.isImportDeclaration).flatMap(i => {
    const bindings = i.importClause?.namedBindings;
    return bindings && ts.isNamedImports(bindings) ? bindings.elements.map(e => e.name.text) : [];
  });
  const buses = [{ identifier: 123, name: "Bus", campusIds: ["campus"] }];
  const component = runInNewContext(code, {
    ...Object.fromEntries(imports.map(name => [name, name])),
    React: { ...React, useEffect: () => {}, useMemo: (fn: () => unknown) => fn(), useRef: () => ({ current: null }),
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
        return [state[index], (next: unknown) => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
      },
    },
    api: { students: {}, campus: { getOptions: "campuses" }, buses: { options: "buses" } },
    useMutation: () => () => {},
    useQuery: (name: string) => name === "buses" ? buses : name === "campuses" ? [{ id: "campus", label: "School" }] : null,
    useTranslations: () => (key: string) => key,
    GRADES: ["4th"], format: () => "Birthday", cn: (...values: string[]) => values.join(" "), normalizeVehicleIdentifier,
    alert: (message: string) => { throw Error(message); },
  });
  const submitted: Record<string, unknown>[] = [];
  const props = { mode: "edit", open: true, onOpenChange: () => {}, onSubmit: (data: Record<string, unknown>) => submitted.push(data),
    student: { id: "student", firstName: "Ana", lastName: "Test", birthday: "01/01/2015", grade: "4th", campusId: "campus", carNumber: 20, busNumber: 123 },
  };
  type Element = React.ReactElement<Record<string, unknown>>;
  const render = () => {
    cursor = 0;
    const nodes: Element[] = [];
    const visit = (node: React.ReactNode) => React.Children.forEach(node, child => {
      if (!React.isValidElement<Record<string, unknown>>(child)) return;
      nodes.push(child); visit(child.props.children as React.ReactNode);
    });
    visit(component(props));
    return nodes;
  };
  const car = () => render().find(n => n.props.id === "carNumber")!.props;
  const bus = () => render().find(n => n.type === "BusSelect")!.props;
  assert.equal(car().value, "20");
  assert.equal(bus().value, "123");
  assert.equal(render().some(n => n.props["aria-label"] === "vehicleType"), false);
  (car().onChange as (e: object) => void)({ target: { value: "21" } });
  assert.equal(bus().value, "123");
  (render().find(n => n.props["aria-label"] === "removeAssignment")!.props.onClick as () => void)();
  assert.equal(bus().value, "");
  assert.equal(car().value, "21");
  const submit = async () => (render().find(n => n.type === "form")!.props.onSubmit as (e: object) => Promise<void>)({ preventDefault() {} });
  await submit();
  assert.equal(submitted[0].carNumber, 21);
  assert.equal(submitted[0].busNumber, 0);
  (bus().onChange as (value: string) => void)("123");
  await submit();
  assert.equal(submitted[1].carNumber, 21);
  assert.equal(submitted[1].busNumber, 123);
});
