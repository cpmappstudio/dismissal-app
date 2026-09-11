import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import ts from "typescript";

test("campus badges select one roster and the compact driver card includes usernames", () => {
  const cardFile = "../components/dismissal/bus-roster-panel.tsx";
  const cardSource = ts.createSourceFile(
    cardFile,
    readFileSync(new URL(cardFile, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const driverFile = "../app/[locale]/(dashboard)/bus/page.tsx";
  const driverSource = ts.createSourceFile(
    driverFile,
    readFileSync(new URL(driverFile, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const file = "../app/[locale]/(dashboard)/operators/buses/[busId]/page.tsx";
  const source = ts.createSourceFile(
    file,
    readFileSync(new URL(file, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const component = source.statements.find(ts.isFunctionDeclaration)!;
  const { outputText } = ts.transpileModule(
    cardSource.statements
      .find(ts.isFunctionDeclaration)!
      .getText(cardSource)
      .replace("export ", "") +
      "\n" +
      driverSource.statements
        .find(ts.isFunctionDeclaration)!
        .getText(driverSource)
        .replace("export default ", "") +
      "\n" +
      component.getText(source).replace("export default ", "") +
      "\n({ BusDetailPage, BusPage, BusRosterPanel });",
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  let selected = "";
  const campuses = [
    { id: "a", name: "Campus A", timezone: "UTC" },
    { id: "b", name: "Campus B", timezone: "UTC" },
  ];
  const components = runInNewContext(outputText, {
    React,
    use: () => ({ locale: "en", busId: "bus" }),
    useState: () => [
      selected,
      (value: string) => {
        selected = value;
      },
    ],
    useConvexAuth: () => ({ isAuthenticated: true }),
    useTranslations: () => (key: string) => key,
    useQuery: () => ({
      _id: "bus",
      name: "Bus",
      identifier: 123,
      busNumber: 123,
      campuses,
      drivers: [{ id: "driver", name: "Ana", username: "ana123" }],
    }),
    api: {
      buses: { get: "get" },
      studentDismissals: { getDriverContext: "getDriverContext" },
    },
    ...Object.fromEntries(
      [
        "DetailHeader",
        "BusDialog",
        "BusHero",
        "BusRoster",
        "Card",
        "CardContent",
        "CardHeader",
        "CardTitle",
        "Badge",
        "ScrollArea",
        "ScrollBar",
      ].map((name) => [name, name]),
    ),
  });
  let page = components.BusDetailPage;
  type Element = React.ReactElement<Record<string, unknown>>;
  function render() {
    const elements: Element[] = [];
    function visit(node: React.ReactNode) {
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement<Record<string, unknown>>(child)) return;
        elements.push(child);
        if (child.type === components.BusRosterPanel) {
          visit(components.BusRosterPanel(child.props));
          return;
        }
        visit(child.props.children as React.ReactNode);
      });
    }
    visit(page({}));
    return elements;
  }
  const buttons = () => render().filter((node) => node.type === "button");
  const roster = () => render().find((node) => node.type === "BusRoster")!;
  assert.equal(
    render().find((node) => node.type === "ScrollArea")!.props.className,
    "w-full min-w-0 max-w-full",
    "Campus scrolling stays within the available page width",
  );
  assert.equal(
    render().find((node) => node.type === "ScrollBar")!.props.orientation,
    "horizontal",
  );
  const campusGroup = render().find((node) => node.props.role === "group")!;
  assert.match(String(campusGroup.props.className), /w-max/);
  assert.doesNotMatch(String(campusGroup.props.className), /flex-wrap/);
  assert.ok(
    render()
      .filter((node) => node.type === "Badge")
      .every((node) =>
        /shrink-0.*whitespace-nowrap/.test(String(node.props.className)),
      ),
    "Campus badges remain in one row without wrapping their labels",
  );
  assert.deepEqual(
    buttons().map((node) => node.props["aria-pressed"]),
    [true, false],
  );
  assert.equal(roster().props.campus, "Campus A");
  const initialRosterKey = roster().key;
  (buttons()[1].props.onClick as () => void)();
  assert.deepEqual(
    buttons().map((node) => node.props["aria-pressed"]),
    [false, true],
  );
  assert.equal(roster().props.campus, "Campus B");
  assert.notEqual(
    roster().key,
    initialRosterKey,
    "Switching campus returns to today rather than retaining an empty historical date",
  );
  assert.equal(roster().props.showDate, true);
  assert.ok(
    render().some(
      (node) =>
        node.type === "span" &&
        React.Children.toArray(node.props.children as React.ReactNode).join(
          "",
        ) === "@ana123",
    ),
  );
  assert.equal(
    buttons().length,
    2,
    "Only campus buttons, no manage-drivers button",
  );
  const managementCard = render().find(
    (node) => node.type === components.BusRosterPanel,
  )!;
  page = components.BusPage;
  assert.equal(
    render()[0].props.className,
    "w-full min-w-0 pb-8",
    "The driver page uses the dashboard spacing without extra horizontal padding or a narrower container",
  );
  const driverCard = render().find(
    (node) => node.type === components.BusRosterPanel,
  )!;
  assert.deepEqual(
    driverCard.props,
    managementCard.props,
    "Both pages use the same card with their authorized bus context",
  );
  assert.equal(
    render().some((node) => node.type === "select"),
    false,
  );
  assert.equal(roster().props.showDate, true);
  assert.equal(roster().props.campus, "Campus B");
  assert.equal(components.BusRosterPanel(managementCard.props).type, "div");
  assert.equal(
    render().some(
      (node) => node.type === "Card" || node.type === "CardContent",
    ),
    false,
    "The shared roster has no outer card",
  );
  (buttons()[0].props.onClick as () => void)();
  assert.equal(roster().props.campus, "Campus A");
  (buttons()[1].props.onClick as () => void)();
  campuses.pop();
  assert.equal(
    roster().props.campus,
    "Campus A",
    "Removed campuses fall back to an available campus",
  );
  assert.equal(
    buttons().length,
    1,
    "Single-campus assignments still identify the campus",
  );
  campuses.pop();
  assert.equal(
    render().some((node) => node.type === "BusRoster"),
    false,
  );
  assert.ok(render().some((node) => node.props.children === "noAssignment"));
});
