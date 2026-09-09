"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindbreakLegend = WindbreakLegend;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_intl_1 = require("react-intl");
/**
 * Map legend: what the three layer styles mean.
 * (In the island.is monorepo this would be built from island-ui's
 * Box/Text/Tag components; here it is plain semantic markup.)
 */
function WindbreakLegend() {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "windbreak-legend", "aria-hidden": "true", children: [(0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("i", { className: "windbreak-swatch windbreak-swatch-parcel" }), (0, jsx_runtime_1.jsx)(react_intl_1.FormattedMessage, { id: "map.legendParcels" })] }), (0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("i", { className: "windbreak-swatch windbreak-swatch-established" }), (0, jsx_runtime_1.jsx)(react_intl_1.FormattedMessage, { id: "map.legendEstablished" })] }), (0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("i", { className: "windbreak-swatch windbreak-swatch-pending" }), (0, jsx_runtime_1.jsx)(react_intl_1.FormattedMessage, { id: "map.legendPending" })] })] }));
}
