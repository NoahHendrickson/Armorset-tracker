import type { OptimizerLookupPayload } from "@/lib/views/optimizer-lookup-payload";

export const MOCK_OPTIMIZER_LOOKUP: OptimizerLookupPayload = {
  subclasses: [
    { key: "void.warlock", label: "Void Warlock", element: "void", classType: 2 },
    { key: "solar.titan", label: "Solar Titan", element: "solar", classType: 0 },
  ],
  fragmentsBySubclass: {
    solar: [
      {
        plugHash: 2001,
        name: "Ember of Beams",
        iconPath: "/common/destiny2_content/icons/ember.png",
        subclassKey: "solar",
        deltas: [{ stat: "Super", value: 10 }],
      },
      {
        plugHash: 2002,
        name: "Ember of Benevolence",
        iconPath: "/common/destiny2_content/icons/ember.png",
        subclassKey: "solar",
        deltas: [{ stat: "Health", value: -10 }],
      },
      {
        plugHash: 2003,
        name: "Ember of Combustion",
        iconPath: "/common/destiny2_content/icons/ember.png",
        subclassKey: "solar",
        deltas: [{ stat: "Weapons", value: 10 }],
      },
    ],
    "void.warlock": [
      {
        plugHash: 1001,
        name: "Echo of Exchange",
        iconPath: "/common/destiny2_content/icons/echo.png",
        subclassKey: "void.warlock",
        deltas: [{ stat: "Grenade", value: 10 }],
      },
      {
        plugHash: 1002,
        name: "Echo of Undermining",
        iconPath: "/common/destiny2_content/icons/echo2.png",
        subclassKey: "void.warlock",
        deltas: [
          { stat: "Weapons", value: 10 },
          { stat: "Melee", value: -10 },
        ],
      },
    ],
  },
  fragmentPlugs: [
    {
      plugHash: 2001,
      name: "Ember of Beams",
      iconPath: "/common/destiny2_content/icons/ember.png",
      subclassKey: "solar",
      deltas: [{ stat: "Super", value: 10 }],
    },
    {
      plugHash: 2002,
      name: "Ember of Benevolence",
      iconPath: "/common/destiny2_content/icons/ember.png",
      subclassKey: "solar",
      deltas: [{ stat: "Health", value: -10 }],
    },
    {
      plugHash: 2003,
      name: "Ember of Combustion",
      iconPath: "/common/destiny2_content/icons/ember.png",
      subclassKey: "solar",
      deltas: [{ stat: "Weapons", value: 10 }],
    },
    {
      plugHash: 1001,
      name: "Echo of Exchange",
      iconPath: "/common/destiny2_content/icons/echo.png",
      subclassKey: "void.warlock",
      deltas: [{ stat: "Grenade", value: 10 }],
    },
    {
      plugHash: 1002,
      name: "Echo of Undermining",
      iconPath: "/common/destiny2_content/icons/echo2.png",
      subclassKey: "void.warlock",
      deltas: [
        { stat: "Weapons", value: 10 },
        { stat: "Melee", value: -10 },
      ],
    },
  ],
  fragmentPlugsByHash: {
    "2001": {
      plugHash: 2001,
      name: "Ember of Beams",
      iconPath: "/common/destiny2_content/icons/ember.png",
      subclassKey: "solar",
      deltas: [{ stat: "Super", value: 10 }],
    },
    "2002": {
      plugHash: 2002,
      name: "Ember of Benevolence",
      iconPath: "/common/destiny2_content/icons/ember.png",
      subclassKey: "solar",
      deltas: [{ stat: "Health", value: -10 }],
    },
    "2003": {
      plugHash: 2003,
      name: "Ember of Combustion",
      iconPath: "/common/destiny2_content/icons/ember.png",
      subclassKey: "solar",
      deltas: [{ stat: "Weapons", value: 10 }],
    },
    "1001": {
      plugHash: 1001,
      name: "Echo of Exchange",
      iconPath: "/common/destiny2_content/icons/echo.png",
      subclassKey: "void.warlock",
      deltas: [{ stat: "Grenade", value: 10 }],
    },
    "1002": {
      plugHash: 1002,
      name: "Echo of Undermining",
      iconPath: "/common/destiny2_content/icons/echo2.png",
      subclassKey: "void.warlock",
      deltas: [
        { stat: "Weapons", value: 10 },
        { stat: "Melee", value: -10 },
      ],
    },
  },
  setPerks: [
    {
      setHash: 501,
      setName: "Techsec",
      requiredSetCount: 2,
      perkHash: 9001,
      name: "Force Absorption",
      description: "Kinetic damage bonus vs shields.",
      iconPath: "",
    },
    {
      setHash: 501,
      setName: "Techsec",
      requiredSetCount: 4,
      perkHash: 9002,
      name: "Reactive Shock",
      description: "Emit a shockwave when breaking shields.",
      iconPath: "",
    },
  ],
  setPerksBySetHash: {
    "501": [
      {
        setHash: 501,
        setName: "Techsec",
        requiredSetCount: 2,
        perkHash: 9001,
        name: "Force Absorption",
        description: "Kinetic damage bonus vs shields.",
        iconPath: "",
      },
      {
        setHash: 501,
        setName: "Techsec",
        requiredSetCount: 4,
        perkHash: 9002,
        name: "Reactive Shock",
        description: "Emit a shockwave when breaking shields.",
        iconPath: "",
      },
    ],
  },
  exoticStatBudget: {
    byItemHash: {},
    byIdentity: {},
  },
};
