import { describe, it, expect } from "vitest";
import { RockRMSClient } from "../sync/rock-client";

const client = new RockRMSClient("https://rms.spiritchurch.co/api", "test-key");

describe("transformGroup", () => {
  it("maps basic fields correctly", () => {
    const raw = {
      Id: 42,
      Name: "Downtown Life Group",
      Description: "A great group",
      GroupTypeId: 25,
      ParentGroupId: 85,
      CampusId: 1,
      IsActive: true,
      IsPublic: true,
      GroupCapacity: 20,
      ActiveMemberCount: 8,
      Campus: { Name: "Downtown" },
      GroupType: { Name: "Spirit Group" },
      Schedule: { WeeklyTimeOfDay: "18:00:00", Description: "Tuesdays at 6pm" },
      AttributeValues: {},
    };

    const result = client.transformGroup(raw);

    expect(result.rock_id).toBe(42);
    expect(result.name).toBe("Downtown Life Group");
    expect(result.slug).toBe("downtown-life-group");
    expect(result.meeting_time).toBe("6:00 PM");
    expect(result.schedule_description).toBe("Tuesdays at 6pm");
    expect(result.registration_url).toBe(
      "https://rms.spiritchurch.co/GroupRegistration?GroupId=42"
    );
    expect(result.current_members).toBe(8);
    expect(result.topics).toEqual([]);
    expect(result.audience).toEqual([]);
    expect(result.life_stages).toEqual([]);
  });

  it("extracts multi-select topics from ValueFormatted", () => {
    const raw = {
      Id: 1,
      Name: "Test",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
      AttributeValues: { Topic: { ValueFormatted: "Prayer, Bible Study" } },
    };
    expect(client.transformGroup(raw).topics).toEqual(["Prayer", "Bible Study"]);
  });

  it("takes only first city value", () => {
    const raw = {
      Id: 1,
      Name: "Test",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
      AttributeValues: {
        SpiritGroupLocation: { ValueFormatted: "Phoenix, Tempe" },
      },
    };
    expect(client.transformGroup(raw).city).toBe("Phoenix");
  });

  it("returns null meeting_time when schedule is absent", () => {
    const raw = {
      Id: 1,
      Name: "Test",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
    };
    expect(client.transformGroup(raw).meeting_time).toBeNull();
  });

  it("defaults current_members to 0 when absent", () => {
    const raw = {
      Id: 1,
      Name: "Test",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
    };
    expect(client.transformGroup(raw).current_members).toBe(0);
  });

  it("sets registration_url using group Id", () => {
    const raw = {
      Id: 99,
      Name: "Test",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
    };
    expect(client.transformGroup(raw).registration_url).toContain("GroupId=99");
  });

  it("maps IsArchived=true to is_archived=true", () => {
    const raw = {
      Id: 1,
      Name: "Archived Group",
      Description: "",
      GroupTypeId: 25,
      IsActive: false,
      IsPublic: false,
      IsArchived: true,
    };
    expect(client.transformGroup(raw).is_archived).toBe(true);
  });

  it("maps IsArchived=false to is_archived=false", () => {
    const raw = {
      Id: 1,
      Name: "Active Group",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
      IsArchived: false,
    };
    expect(client.transformGroup(raw).is_archived).toBe(false);
  });

  it("defaults is_archived to false when IsArchived is absent", () => {
    const raw = {
      Id: 1,
      Name: "No Archive Field",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
    };
    expect(client.transformGroup(raw).is_archived).toBe(false);
  });
});
