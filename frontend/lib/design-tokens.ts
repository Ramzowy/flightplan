/**
 * FlightPlan design tokens (spec §8). The CSS source of truth lives in
 * app/globals.css; these mirror it for places that need raw values (SVG).
 */
export const tokens = {
  bg: "#071827",
  panel: "#11283C",
  panelRaised: "#19364C",
  accentTeal: "#20DBCF",
  complete: "#55D5A5",
  current: "#5DB8F5",
  infoCard: "#DDEEF6",
  inkOnLight: "#102D42",
  mutedOnLight: "#57738A",
  line: "#3A5A72",
  amber: "#F4C76A",
  ucOptionalRed: "#E00122",
  ucOptionalBlack: "#000000",
} as const;

export const SCREEN_COUNT = 18;
