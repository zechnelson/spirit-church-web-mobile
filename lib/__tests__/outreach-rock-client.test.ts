import { describe, it, expect } from "vitest";
import { OutreachRockClient } from "../sync/outreach/rock-client";
import type { RockRawSignUpGroup } from "../sync/outreach/types";

const client = new OutreachRockClient(
  "https://rms.spiritchurch.co/api",
  "test-key",
  42
);

const baseRaw: RockRawSignUpGroup = {
  Id: 100,
  IdKey: "abc123",
  Name: "Feed My Starving Children",
  Description: "Help pack meals",
  GroupTypeId: 42,
  IsActive: true,
  IsArchived: false,
  Campus: { Name: "Chandler Campus" },
  AttributeValues: {
    Semester: { ValueFormatted: "Fall 2026" },
    Event: { ValueFormatted: "Serve Day" },
    Category: { ValueFormatted: "Food Prep & Distribution" },
    KidsWelcome: { Value: "True" },
    HandicapAccessible: { Value: "True" },
    ToolsSuppliesNeeded: { Value: "Gloves and apron" },
    ProjectType: { ValueFormatted: "In-Person" },
  },
  GroupLocations: [
    {
      Id: 200,
      IdKey: "loc456",
      Location: {
        Street1: "1100 W Grove Pkwy Ste 101",
        City: "Tempe",
        State: "AZ",
        PostalCode: "85283",
        FormattedAddress: "1100 W Grove Pkwy Ste 101, Tempe, AZ 85283",
      },
      Schedules: [
        {
          Id: 300,
          IdKey: "sch789",
          Description: "Once at 7/11/2026 9:00 AM",
          NextStartDateTime: "2026-07-11T09:00:00",
        },
      ],
    },
  ],
};

describe("transformProject", () => {
  it("maps basic fields", () => {
    const result = client.transformProject(baseRaw);
    expect(result).not.toBeNull();
    expect(result!.rock_group_id).toBe(100);
    expect(result!.rock_opportunity_id).toBe(200);
    expect(result!.rock_schedule_id).toBe(300);
    expect(result!.name).toBe("Feed My Starving Children");
    expect(result!.slug).toBe("feed-my-starving-children");
    expect(result!.description).toBe("Help pack meals");
    expect(result!.is_active).toBe(true);
    expect(result!.is_archived).toBe(false);
  });

  it("constructs signup_url from IdKeys", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.signup_url).toBe(
      "https://rms.spiritchurch.co/signups/register/abc123/location/loc456/schedule/sch789"
    );
  });

  it("returns null signup_url when group IdKey is missing", () => {
    const raw = { ...baseRaw, IdKey: undefined };
    const result = client.transformProject(raw);
    expect(result!.signup_url).toBeNull();
  });

  it("returns null signup_url when location IdKey is missing", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      GroupLocations: [{ ...baseRaw.GroupLocations![0], IdKey: undefined }],
    };
    const result = client.transformProject(raw);
    expect(result!.signup_url).toBeNull();
  });

  it("returns null signup_url when schedule IdKey is missing", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      GroupLocations: [
        {
          ...baseRaw.GroupLocations![0],
          Schedules: [{ ...baseRaw.GroupLocations![0].Schedules![0], IdKey: undefined }],
        },
      ],
    };
    const result = client.transformProject(raw);
    expect(result!.signup_url).toBeNull();
  });

  it("extracts city from Location.City", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.city).toBe("Tempe");
  });

  it("uses FormattedAddress for location_address", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.location_address).toBe(
      "1100 W Grove Pkwy Ste 101, Tempe, AZ 85283"
    );
  });

  it("falls back to assembled address when FormattedAddress is absent", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      GroupLocations: [
        {
          ...baseRaw.GroupLocations![0],
          Location: {
            Street1: "123 Main St",
            City: "Phoenix",
            State: "AZ",
            PostalCode: "85001",
          },
        },
      ],
    };
    const result = client.transformProject(raw);
    expect(result!.location_address).toBe("123 Main St, Phoenix, AZ, 85001");
  });

  it("maps schedule_display from Schedule.Description", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.schedule_display).toBe("Once at 7/11/2026 9:00 AM");
  });

  it("maps schedule_datetime from NextStartDateTime", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.schedule_datetime).toBe("2026-07-11T09:00:00");
  });

  it("maps campus, semester, event, category, project_type", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.campus).toBe("Chandler Campus");
    expect(result!.semester).toBe("Fall 2026");
    expect(result!.event).toBe("Serve Day");
    expect(result!.category).toBe("Food Prep & Distribution");
    expect(result!.project_type).toBe("In-Person");
  });

  it("maps kids_welcome=true when attribute Value is 'True'", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.kids_welcome).toBe(true);
  });

  it("maps kids_welcome=false when attribute Value is 'False'", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      AttributeValues: {
        ...baseRaw.AttributeValues,
        KidsWelcome: { Value: "False" },
      },
    };
    const result = client.transformProject(raw);
    expect(result!.kids_welcome).toBe(false);
  });

  it("defaults kids_welcome to true when attribute is absent", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      AttributeValues: { ...baseRaw.AttributeValues, KidsWelcome: undefined },
    };
    const result = client.transformProject(raw);
    expect(result!.kids_welcome).toBe(true);
  });

  it("defaults handicap_accessible to true when attribute is absent", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      AttributeValues: { ...baseRaw.AttributeValues, HandicapAccessible: undefined },
    };
    const result = client.transformProject(raw);
    expect(result!.handicap_accessible).toBe(true);
  });

  it("maps is_archived=true", () => {
    const raw = { ...baseRaw, IsArchived: true };
    const result = client.transformProject(raw);
    expect(result!.is_archived).toBe(true);
  });

  it("defaults is_archived to false when absent", () => {
    const { IsArchived: _, ...rawWithout } = baseRaw;
    const result = client.transformProject(rawWithout as RockRawSignUpGroup);
    expect(result!.is_archived).toBe(false);
  });

  it("returns null when group has no GroupLocations", () => {
    const raw = { ...baseRaw, GroupLocations: [] };
    const result = client.transformProject(raw);
    expect(result).toBeNull();
  });

  it("sets webflow_item_id to null", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.webflow_item_id).toBeNull();
  });
});
