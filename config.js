"use strict";

const assets = [
  {id:"liquiditaet",name:"Liquidität",color:"#003f8f"},
  {id:"geldwerte",name:"Geldwerte",color:"#299531"},
  {id:"substanzwerte",name:"Substanzwerte",color:"#e01f21"},
  {id:"alternativ",name:"Alternative Anlagen",color:"#7f7f7f"},
  {id:"sachwerte",name:"Sachwerte",color:"#f2a014"}
];

const specialProducts = [
  {id:"sp_private_def",name:"Private Select Defensiv",wkn:"–",category:"Vermögensverwaltung",rk:2,horizon:">5",
    allocations:{liquiditaet:0,geldwerte:75,substanzwerte:25,alternativ:0,sachwerte:0},region:"Weltweit",sector:"Multi Asset",
    theme:"Keine Präferenz",factor:"Keine Präferenz",sustainable:"Keine Angabe",coreSatellite:"Core",
    source:"Musterportfolio 11.03.2026 · Asset-Aufteilung rechnerisch abgeleitet",isHouseOpinion:false,minInvestment:125000},
  {id:"sp_private_bal",name:"Private Select Ausgewogen",wkn:"–",category:"Vermögensverwaltung",rk:3,horizon:">5",
    allocations:{liquiditaet:0,geldwerte:55,substanzwerte:45,alternativ:0,sachwerte:0},region:"Weltweit",sector:"Multi Asset",
    theme:"Keine Präferenz",factor:"Keine Präferenz",sustainable:"Keine Angabe",coreSatellite:"Core",
    source:"Musterportfolio 11.03.2026 · Asset-Aufteilung rechnerisch abgeleitet",isHouseOpinion:false,minInvestment:125000},
  {id:"sp_private_off",name:"Private Select Offensiv",wkn:"–",category:"Vermögensverwaltung",rk:4,horizon:">5",
    allocations:{liquiditaet:0,geldwerte:35,substanzwerte:65,alternativ:0,sachwerte:0},region:"Weltweit",sector:"Multi Asset",
    theme:"Keine Präferenz",factor:"Keine Präferenz",sustainable:"Keine Angabe",coreSatellite:"Core",
    source:"Musterportfolio 11.03.2026 · Asset-Aufteilung rechnerisch abgeleitet",isHouseOpinion:false,minInvestment:125000},
  {id:"sp_uer2031",name:"UER Unternehmensanleihen 2031 II -net- A",wkn:"–",category:"Rentenfonds",rk:2,horizon:">5",
    allocations:{liquiditaet:0,geldwerte:100,substanzwerte:0,alternativ:0,sachwerte:0},region:"Weltweit",sector:"Unternehmensanleihen",
    theme:"EUR",factor:"Laufzeitenfonds",sustainable:"Nein",coreSatellite:"Core",
    source:"Musterportfolio 11.03.2026 · nicht in Fonds-Matrix 01.07.2026",isHouseOpinion:false},
  {id:"sp_zinsfix",name:"ZinsFix Index",wkn:"–",category:"Strukturiertes Produkt",rk:null,horizon:"–",
    allocations:{liquiditaet:0,geldwerte:0,substanzwerte:100,alternativ:0,sachwerte:0},region:"–",sector:"–",theme:"–",factor:"Puffer",
    sustainable:"Keine Angabe",coreSatellite:"Satellit",source:"Musterportfolio 11.03.2026 · Sonderbaustein",isHouseOpinion:false},
  {id:"sp_mea",name:"MEA Einzelwert",wkn:"–",category:"Strukturiertes Produkt",rk:null,horizon:"–",
    allocations:{liquiditaet:0,geldwerte:0,substanzwerte:100,alternativ:0,sachwerte:0},region:"–",sector:"–",theme:"–",factor:"Airbag",
    sustainable:"Keine Angabe",coreSatellite:"Satellit",source:"Musterportfolio 11.03.2026 · Sonderbaustein",isHouseOpinion:false}
];

const allProducts = [...specialProducts,...houseUniverse];
const productById = Object.fromEntries(allProducts.map(p=>[p.id,p]));

function normalizeName(value){
  return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
}
const productByName = new Map(allProducts.map(p=>[normalizeName(p.name),p]));

const profiles = {
  rb2:{label:"RB 2",name:"Modellportfolio RB 2 – sicherheitsorientiert",
    description:"Sicherheitsorientierte Ausrichtung mit Schwerpunkt auf Geldwerten, begrenztem Substanzwertanteil und diversifizierenden alternativen Anlagen.",
    allocations:{liquiditaet:0,geldwerte:70,substanzwerte:20,alternativ:10,sachwerte:0},
    products:[
      ["Private Select Defensiv",50,"Aktiv gemanagtes Basisinvestment."],
      ["UER Unternehmensanleihen 2031 II -net- A",15,"Längerer Laufzeitbaustein für Euro-Unternehmensanleihen."],
      ["Carmignac Credit 2029",10,"Aktiver Credit-Baustein mit festem Laufzeithorizont."],
      ["UER Corporates A",7.5,"Flexibler Rentenbaustein der Laufzeitenstaffelung."],
      ["UniDividendenAss -net- A",2.5,"Europäischer Qualitäts- und Dividendenbaustein."],
      ["UniMarktführer -net- A",2.5,"Globaler Qualitätsbaustein."],
      ["ZinsFix Index",2.5,"Pufferorientierter Stabilitätsbaustein."],
      ["Xetra-Gold",5,"Goldbeimischung zur Diversifikation."],
      ["Allianz PrivateFinancePolice",5,"Private Markets und Infrastruktur."]
    ]},
  rb3:{label:"RB 3",name:"Modellportfolio RB 3 – ausgewogen",
    description:"Ausgewogene Verbindung von Geldwerten und Substanzwerten mit einem höheren Diversifikationsanteil durch alternative Anlagen.",
    allocations:{liquiditaet:0,geldwerte:45,substanzwerte:40,alternativ:15,sachwerte:0},
    products:[
      ["Private Select Ausgewogen",50,"Aktiv gemanagtes Basisinvestment."],
      ["UER Unternehmensanleihen 2031 II -net- A",7.5,"Längerer Laufzeitbaustein."],
      ["Carmignac Credit 2029",5,"Aktiver Credit-Baustein."],
      ["UER Corporates A",5,"Flexibler Rentenbaustein."],
      ["UniDividendenAss -net- A",5,"Europäischer Qualitäts- und Dividendenbaustein."],
      ["UniMarktführer -net- A",5,"Globaler Qualitätsbaustein."],
      ["ZinsFix Index",5,"Pufferorientierter Ertragsbaustein."],
      ["MEA Einzelwert",2.5,"Kuponorientierter Ertragsbaustein mit Airbag-Mechanik."],
      ["Xetra-Gold",7.5,"Goldbeimischung zur Diversifikation."],
      ["Allianz PrivateFinancePolice",7.5,"Private Markets und Infrastruktur."]
    ]},
  rb4:{label:"RB 4",name:"Modellportfolio RB 4 – chancenorientiert",
    description:"Chancenorientierte Ausrichtung mit hohem Substanzwertanteil, reduzierten Geldwerten und ausgeprägter Beimischung alternativer Anlagen.",
    allocations:{liquiditaet:0,geldwerte:20,substanzwerte:60,alternativ:20,sachwerte:0},
    products:[
      ["Private Select Offensiv",50,"Aktiv gemanagtes offensives Basisinvestment."],
      ["Carmignac Credit 2031",2.5,"Credit-Baustein mit festem Laufzeithorizont."],
      ["UniDividendenAss -net- A",10,"Europäischer Qualitäts- und Dividendenbaustein."],
      ["UniMarktführer -net- A",7.5,"Globaler Qualitätsbaustein."],
      ["ZinsFix Index",5,"Pufferorientierter Ertragsbaustein."],
      ["MEA Einzelwert",5,"Kuponorientierter Ertragsbaustein mit Airbag-Mechanik."],
      ["Xetra-Gold",10,"Goldbeimischung zur Diversifikation."],
      ["Allianz PrivateFinancePolice",10,"Private Markets und Infrastruktur."]
    ]}
};

const riskScores = {
  horizon:{short:0,medium:1,long:2,veryLong:2},lossTolerance:{low:0,medium:1,high:2},
  investmentGoal:{preservation:0,balanced:1,growth:2},marketReaction:{sell:0,hold:1,buy:2},
  experience:{low:0,medium:1,high:2},liquidityNeed:{high:0,medium:1,low:2}
};

const defaultAmounts={liquiditaet:25000,geldwerte:90000,substanzwerte:90000,alternativ:20000,sachwerte:25000};
const categoryColors={"Liquidität":"#003f8f","Geldwerte":"#299531","Substanzwerte":"#e01f21","Alternative Anlagen":"#7f7f7f","Sachwerte":"#f2a014",
  "Aktienfonds":"#e01f21","Rentenfonds":"#299531","Geldmarkt":"#003f8f","Immobilienfonds":"#f2a014","Alternative Anlagen":"#7f7f7f",
  "Mischfonds":"#003f8f","Vermögensverwaltung":"#003f8f","Strukturiertes Produkt":"#e01f21"};

const state={mode:"amount",selectedRisk:"rb3",method:"model",targetOrigin:"Musterportfolio RB 3",
  aiReasons:[],optimized:false,productRows:[],uid:0};

const ids=["horizon","lossTolerance","investmentGoal","marketReaction","experience","liquidityNeed","realAssetPreference",
"sustainabilityPreference","portfolioStyle","manualRisk","riskScore","riskBadge","riskDescription","calculatedProfile",
"calculateTargetButton","methodModelCard","methodAiCard","investmentAmount","tolerance","targetOrigin","allocationRows",
"inputColumnTitle","assignedSummary","statusMessage","optimizeButton","applyButton","resetButton","modeAmount","modePercent",
"kpiInvestment","kpiAssigned","kpiUnassigned","kpiDeviation","donut","donutValue","legend","comparison","autoSyncProducts",
"productCount","productWeightTotal","productUnallocated","productAssetDeviation","loadModelProductsButton","loadAiProductsButton",
"addProductRowButton","normalizeProductsButton","syncProductsButton","targetProductRows","productStatus","productNotice","productInfo",
"optimizationEmpty","optimizationResult","rebalancingList","reasoning","universeSearch","universeCategory","universeAsset",
"universeRisk","universeSustainable","universeRows","universeCount"];
const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
const euro=new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:2});
const number=new Intl.NumberFormat("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2});
