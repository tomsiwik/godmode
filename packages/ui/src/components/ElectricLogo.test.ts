import { describe, expect, it } from "vitest";
import { resolveArcControls } from "./ElectricLogo";

describe("resolveArcControls", () => {
  it("keeps strike controls independent while normalizing the active count", () => {
    expect(
      resolveArcControls({
        arcs: 1.4,
        arcCount: 3.6,
        arcReach: 1.25,
        arcDuration: 0.7,
        arcBend: 1.1,
        arcIntensity: 0.8,
        arcThickness: 0.6,
      }),
    ).toEqual({
      frequency: 1.4,
      count: 4,
      reach: 1.25,
      duration: 0.7,
      bend: 1.1,
      intensity: 0.8,
      thickness: 0.6,
    });
  });

  it("clamps unsafe strike values", () => {
    expect(
      resolveArcControls({
        arcs: -1,
        arcCount: 20,
        arcReach: 0,
        arcDuration: -2,
        arcBend: -1,
        arcIntensity: -3,
        arcThickness: 0,
      }),
    ).toEqual({
      frequency: 0,
      count: 5,
      reach: 0.1,
      duration: 0.1,
      bend: 0,
      intensity: 0,
      thickness: 0.1,
    });
  });
});
