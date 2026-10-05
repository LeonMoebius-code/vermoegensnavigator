import type { ModelPortfolio } from "../domain/catalog/contracts";

export const modelPortfolios: ModelPortfolio[] = [
  {
    id: "rb2",
    name: "Modellportfolio RB 2",
    risk: 2,
    mix: {
      Liquidität: 0,
      Geldwerte: 70,
      Substanzwerte: 20,
      "Alternative Anlagen": 10,
      Sachwerte: 0,
    },
    holdings: [
      { productId: "ps-defensiv", name: "Private Select Defensiv", weight: 50 },
      {
        productId: "uer-2032",
        name: "UER Unternehmensanleihen 2032 -net- A",
        weight: 15,
      },
      {
        productId: "carmignac-2029",
        name: "Carmignac Credit 2029",
        weight: 10,
      },
      { productId: "uer-corporates", name: "UER Corporates A", weight: 7.5 },
      {
        productId: "dividendenass",
        name: "UniDividendenAss -net- A",
        weight: 2.5,
      },
      { productId: "marktführer", name: "UniMarktführer -net- A", weight: 2.5 },
      { productId: "zinsfix", name: "ZinsFix Index", weight: 2.5 },
      { productId: "xetra-gold", name: "Xetra-Gold", weight: 5 },
      {
        productId: "private-finance",
        name: "Allianz PrivateFinancePolice",
        weight: 5,
      },
    ],
  },
  {
    id: "rb3",
    name: "Modellportfolio RB 3",
    risk: 3,
    mix: {
      Liquidität: 0,
      Geldwerte: 45,
      Substanzwerte: 40,
      "Alternative Anlagen": 15,
      Sachwerte: 0,
    },
    holdings: [
      {
        productId: "ps-ausgewogen",
        name: "Private Select Ausgewogen",
        weight: 50,
      },
      {
        productId: "uer-2032",
        name: "UER Unternehmensanleihen 2032 -net- A",
        weight: 7.5,
      },
      { productId: "carmignac-2029", name: "Carmignac Credit 2029", weight: 5 },
      { productId: "uer-corporates", name: "UER Corporates A", weight: 5 },
      {
        productId: "dividendenass",
        name: "UniDividendenAss -net- A",
        weight: 5,
      },
      { productId: "marktführer", name: "UniMarktführer -net- A", weight: 5 },
      { productId: "zinsfix", name: "ZinsFix Index", weight: 5 },
      { productId: "mea", name: "MEA Einzelwert", weight: 2.5 },
      { productId: "xetra-gold", name: "Xetra-Gold", weight: 7.5 },
      {
        productId: "private-finance",
        name: "Allianz PrivateFinancePolice",
        weight: 7.5,
      },
    ],
  },
  {
    id: "rb4",
    name: "Modellportfolio RB 4",
    risk: 4,
    mix: {
      Liquidität: 0,
      Geldwerte: 20,
      Substanzwerte: 60,
      "Alternative Anlagen": 20,
      Sachwerte: 0,
    },
    holdings: [
      { productId: "ps-offensiv", name: "Private Select Offensiv", weight: 50 },
      {
        productId: "carmignac-2031",
        name: "Carmignac Credit 2031",
        weight: 2.5,
      },
      {
        productId: "dividendenass",
        name: "UniDividendenAss -net- A",
        weight: 10,
      },
      { productId: "marktführer", name: "UniMarktführer -net- A", weight: 7.5 },
      { productId: "zinsfix", name: "ZinsFix Index", weight: 5 },
      { productId: "mea", name: "MEA Einzelwert", weight: 5 },
      { productId: "xetra-gold", name: "Xetra-Gold", weight: 10 },
      {
        productId: "private-finance",
        name: "Allianz PrivateFinancePolice",
        weight: 10,
      },
    ],
  },
];
