export type RwandaProvince =
  | 'Kigali City'
  | 'Northern Province'
  | 'Southern Province'
  | 'Eastern Province'
  | 'Western Province';

export interface RwandaLocationTree {
  [district: string]: {
    [sector: string]: {
      [cell: string]: string[];
    };
  };
}

export const RWANDA_PROVINCES: RwandaProvince[] = [
  'Kigali City',
  'Northern Province',
  'Southern Province',
  'Eastern Province',
  'Western Province',
];

export const RWANDA_DISTRICTS_BY_PROVINCE: Record<RwandaProvince, string[]> = {
  'Kigali City': ['Gasabo', 'Kicukiro', 'Nyarugenge'],
  'Northern Province': ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'],
  'Southern Province': [
    'Gisagara',
    'Huye',
    'Kamonyi',
    'Muhanga',
    'Nyamagabe',
    'Nyanza',
    'Nyaruguru',
    'Ruhango',
  ],
  'Eastern Province': [
    'Bugesera',
    'Gatsibo',
    'Kayonza',
    'Kirehe',
    'Ngoma',
    'Nyagatare',
    'Rwamagana',
  ],
  'Western Province': [
    'Karongi',
    'Ngororero',
    'Nyabihu',
    'Nyamasheke',
    'Rubavu',
    'Rusizi',
    'Rutsiro',
  ],
};

export const RWANDA_PROVINCE_BY_DISTRICT: Record<string, RwandaProvince> = Object.entries(
  RWANDA_DISTRICTS_BY_PROVINCE,
).reduce(
  (acc, [province, districts]) => {
    districts.forEach((d) => {
      acc[d] = province as RwandaProvince;
    });
    return acc;
  },
  {} as Record<string, RwandaProvince>,
);

const ALL_SECTORS_BY_DISTRICT: Record<string, string[]> = {
  // Kigali City (35 sectors)
  Gasabo: [
    'Bumbogo', 'Gatsata', 'Gikomero', 'Gisozi', 'Jabana',
    'Jali', 'Kacyiru', 'Kimihurura', 'Kimironko', 'Kinyinya',
    'Ndera', 'Nduba', 'Remera', 'Rusororo', 'Rutunga',
  ],
  Kicukiro: [
    'Gahanga', 'Gatenga', 'Gikondo', 'Kagarama', 'Kanombe',
    'Kicukiro', 'Kigarama', 'Masaka', 'Niboye', 'Nyarugunga',
  ],
  Nyarugenge: [
    'Gitega', 'Kanyinya', 'Kigali', 'Kimisagara', 'Mageragere',
    'Muhima', 'Nyakabanda', 'Nyamirambo', 'Nyarugenge', 'Rwezamenyo',
  ],
  // Northern Province (89 sectors)
  Burera: [
    'Bungwe', 'Butaro', 'Cyanika', 'Cyeru', 'Gahunga', 'Gatebe',
    'Gitovu', 'Kagogo', 'Kinoni', 'Kinyababa', 'Kivuye', 'Nemba',
    'Rugarama', 'Rugengabari', 'Ruhunde', 'Rusarabuye', 'Rwerere',
  ],
  Gakenke: [
    'Busengo', 'Coko', 'Cyabingo', 'Gakenke', 'Gashenyi', 'Janja',
    'Kamubuga', 'Karambo', 'Kivuruga', 'Mataba', 'Minazi', 'Mugunga',
    'Muhondo', 'Muyongwe', 'Muzo', 'Nemba', 'Ruli', 'Rusasa', 'Rushashi',
  ],
  Gicumbi: [
    'Bukure', 'Bwisige', 'Byumba', 'Cyumba', 'Giti', 'Kageyo',
    'Kaniga', 'Manyagiro', 'Miyove', 'Mukarange', 'Muko', 'Mutete',
    'Nyamiyaga', 'Nyankenke', 'Rubaya', 'Rukomo', 'Rushaki', 'Rutare',
    'Ruvune', 'Rwamiko', 'Shangasha',
  ],
  Musanze: [
    'Busogo', 'Cyuve', 'Gacaca', 'Gashaki', 'Gataraga', 'Kimonyi',
    'Kinigi', 'Muhoza', 'Muko', 'Musanze', 'Nkotsi', 'Nyange',
    'Remera', 'Rwaza', 'Shingiro',
  ],
  Rulindo: [
    'Base', 'Burega', 'Bushoki', 'Buyoga', 'Cyinzuzi', 'Cyungo',
    'Kinihira', 'Kisaro', 'Masoro', 'Mbogo', 'Murambi', 'Ngoma',
    'Ntarabana', 'Rukozo', 'Rusiga', 'Shyorongi', 'Tumba',
  ],
  // Southern Province (101 sectors)
  Gisagara: [
    'Gikonko', 'Gishubi', 'Kansi', 'Kibilizi', 'Kigembe', 'Mamba',
    'Muganza', 'Mugombwa', 'Mukindo', 'Musha', 'Ndora', 'Nyanza', 'Save',
  ],
  Huye: [
    'Gishamvu', 'Huye', 'Karama', 'Kigoma', 'Kinazi', 'Maraba',
    'Mbazi', 'Mukura', 'Ngoma', 'Ruhashya', 'Rusatira', 'Rwaniro',
    'Simbi', 'Tumba',
  ],
  Kamonyi: [
    'Gacurabwenge', 'Karama', 'Kayenzi', 'Kayumbu', 'Mugina', 'Musambira',
    'Ngamba', 'Nyamiyaga', 'Nyarubaka', 'Rugalika', 'Rukoma', 'Runda',
  ],
  Muhanga: [
    'Cyeza', 'Kabacuzi', 'Kibangu', 'Kiyumba', 'Muhanga', 'Mushishiro',
    'Nyabinoni', 'Nyamabuye', 'Nyarusange', 'Rongi', 'Rugendabari', 'Shyogwe',
  ],
  Nyamagabe: [
    'Buruhukiro', 'Cyanika', 'Gasaka', 'Gatare', 'Kaduha', 'Kamegeri',
    'Kibirizi', 'Kibumbwe', 'Kitabi', 'Mbazi', 'Mugano', 'Musange',
    'Musebeya', 'Mushubi', 'Nkomane', 'Tare', 'Uwinkingi',
  ],
  Nyanza: [
    'Busasamana', 'Busoro', 'Cyabakamyi', 'Kibilizi', 'Kigoma',
    'Mukingo', 'Muyira', 'Ntyazo', 'Nyagisozi', 'Rwabicuma',
  ],
  Nyaruguru: [
    'Busanze', 'Cyahinda', 'Kibeho', 'Kivu', 'Mata', 'Muganza',
    'Munini', 'Ngera', 'Ngoma', 'Nyabimata', 'Nyagisozi', 'Ruheru',
    'Ruramba', 'Rusenge',
  ],
  Ruhango: [
    'Bweramana', 'Byimana', 'Kabagali', 'Kinazi', 'Kinihira',
    'Mbuye', 'Mwendo', 'Ntongwe', 'Ruhango',
  ],
  // Eastern Province (95 sectors)
  Bugesera: [
    'Gashora', 'Juru', 'Kamabuye', 'Mareba', 'Mayange',
    'Musenyi', 'Mwogo', 'Ngeruka', 'Ntarama', 'Nyamata',
    'Nyarugenge', 'Rilima', 'Ruhuha', 'Rweru', 'Shyara',
  ],
  Gatsibo: [
    'Gasange', 'Gatsibo', 'Gitoki', 'Kabarore', 'Kageyo',
    'Kiramuruzi', 'Kiziguro', 'Muhura', 'Murambi', 'Ngarama',
    'Nyagihanga', 'Remera', 'Rugarama', 'Rwimbogo',
  ],
  Kayonza: [
    'Gahini', 'Kabare', 'Kabarondo', 'Mukarange', 'Murama', 'Murundi',
    'Mwiri', 'Ndego', 'Nyamirama', 'Rukara', 'Ruramira', 'Rwinkwavu',
  ],
  Kirehe: [
    'Gahara', 'Gatore', 'Kigarama', 'Kigina', 'Kirehe', 'Mahama',
    'Mpanga', 'Musaza', 'Mushikiri', 'Nasho', 'Nyamugari', 'Nyarubuye',
  ],
  Ngoma: [
    'Gashanda', 'Jarama', 'Karembo', 'Kazo', 'Kibungo', 'Mugesera',
    'Murama', 'Mutenderi', 'Remera', 'Rukira', 'Rukumberi', 'Rurenge',
    'Sake', 'Zaza',
  ],
  Nyagatare: [
    'Gatunda', 'Karama', 'Karangazi', 'Katabagemu', 'Kiyombe',
    'Matimba', 'Mimuli', 'Mukama', 'Musheli', 'Nyagatare',
    'Rukomo', 'Rwempasha', 'Rwimiyaga', 'Tabagwe',
  ],
  Rwamagana: [
    'Fumbwe', 'Gahengeri', 'Gishali', 'Karenge', 'Kigabiro',
    'Muhazi', 'Munyaga', 'Munyiginya', 'Musha', 'Muyumbu',
    'Mwulire', 'Nyakaliro', 'Nzige', 'Rubona',
  ],
  // Western Province (96 sectors)
  Karongi: [
    'Bwishyura', 'Gashari', 'Gishyita', 'Gitesi', 'Mubuga', 'Murambi',
    'Murundi', 'Mutuntu', 'Rubengera', 'Rugabano', 'Ruganda', 'Rwankuba', 'Twumba',
  ],
  Ngororero: [
    'Bwira', 'Gatumba', 'Hindiro', 'Kabaya', 'Kageyo', 'Kavumu',
    'Matyazo', 'Muhanda', 'Muhororo', 'Ndaro', 'Ngororero', 'Nyange', 'Sovu',
  ],
  Nyabihu: [
    'Bigogwe', 'Jenda', 'Jomba', 'Kabatwa', 'Karago', 'Kintobo',
    'Mukamira', 'Muringa', 'Rambura', 'Rugera', 'Rurembo', 'Shyira',
  ],
  Nyamasheke: [
    'Bushekeri', 'Bushenge', 'Cyato', 'Gihombo', 'Kagano', 'Kanjongo',
    'Karambi', 'Karengera', 'Kirimbi', 'Macuba', 'Mahembe', 'Nyabitekeri',
    'Rangiro', 'Ruharambuga', 'Shangi',
  ],
  Rubavu: [
    'Bugeshi', 'Busasamana', 'Cyanzarwe', 'Gisenyi', 'Kanama', 'Kanzenze',
    'Mudende', 'Nyakiriba', 'Nyamyumba', 'Nyundo', 'Rubavu', 'Rugerero',
  ],
  Rusizi: [
    'Bugarama', 'Butare', 'Bweyeye', 'Gashonga', 'Giheke', 'Gihundwe',
    'Gikundamvura', 'Gitambi', 'Kamembe', 'Muganza', 'Mururu', 'Nkanka',
    'Nkombo', 'Nkungu', 'Nyakabuye', 'Nyakarenzo', 'Nzahaha', 'Rwimbogo',
  ],
  Rutsiro: [
    'Boneza', 'Gihango', 'Kigeyo', 'Kivumu', 'Manihira', 'Mukura',
    'Murunda', 'Musasa', 'Mushonyi', 'Mushubati', 'Nyabirasi', 'Ruhango', 'Rusebeya',
  ],
};

const CURATED_CELLS_AND_VILLAGES: RwandaLocationTree = {
  Gasabo: {
    Kimironko: {
      Bibare: ['Abatuje', 'Amariza', 'Imanzi', 'Inganji', 'Nyagatovu'],
      Kibagabaga: ['Akintwari', 'Buranga', 'Gasharu', 'Kagugu', 'Karisimbi'],
      Nyagatovu: ['Ibukinanyana', 'Ituze', 'Urugwiro', 'Urumuri'],
    },
    Remera: {
      Nyabisindu: ['Amahoro', 'Gihogere', 'Rukiri', 'Umucyo'],
      Rukiri_I: ['Agashyitsi', 'Amajyambere', 'Gisimenti', 'Ubumwe'],
      Rukiri_II: ['Amahoro', 'Rebero', 'Urugwiro'],
    },
    Kacyiru: {
      Kamatamu: ['Amahoro', 'Bukinanyana', 'Kabare', 'Kamuhire'],
      Kamutwa: ['Agasaro', 'Gasharu', 'Inkingi', 'Umutekano'],
      Kibaza: ['Ineza', 'Iriba', 'Urugwiro'],
    },
    Kimihurura: {
      Kamukina: ['Inyange', 'Isangano', 'Juru', 'Ubumwe'],
      Kimihurura: ['Amahoro', 'Imihigo', 'Urwego'],
      Rugando: ['Gasasa', 'Rebero', 'Taba'],
    },
    Gisozi: {
      Musezero: ['Amarembo', 'Gasave', 'Nyarurembo', 'Rwinyana'],
      Ruhango: ['Kagarama', 'Ntora', 'Umurava'],
    },
    Kinyinya: {
      Gacuriro: ['Agatare', 'Akintwari', 'Urugero'],
      Kagugu: ['Gasharu', 'Giheka', 'Kabuye'],
      Murama: ['Nyarutarama', 'Taba'],
    },
  },
  Kicukiro: {
    Niboye: {
      Gatare: ['Amahoro', 'Byimana', 'Kagarama', 'Ruganwa'],
      Niboye: ['Gasharu', 'Nyarubande', 'Sano'],
      Nyakabanda: ['Amajyambere', 'Kabeza', 'Rukurazo'],
    },
    Kanombe: {
      Busanza: ['Gasharu', 'Kabeza', 'Karama', 'Nyarugugu'],
      Kabeza: ['Akagera', 'Amahoro', 'Giporoso', 'Nyandungu'],
      Karama: ['Gikundiro', 'Nyarurembo', 'Ubumwe'],
    },
    Kagarama: {
      Kanserege: ['Bwiza', 'Ituze', 'Kanserege'],
      Muyange: ['Kigali', 'Muyange', 'Rugando'],
      Rukatsa: ['Amarembo', 'Rukatsa', 'Taba'],
    },
    Gahanga: {
      Gahanga: ['Gahanga', 'Kagasa', 'Rwabutenge'],
      Kagasa: ['Kabeza', 'Nyamabuye', 'Rugarama'],
    },
    Nyarugunga: {
      Kamashashi: ['Gasharu', 'Kamashashi', 'Mukoni'],
      Nonko: ['Gitwiko', 'Nonko', 'Rwimbogo'],
    },
  },
  Nyarugenge: {
    Nyarugenge: {
      Agatare: ['Amahoro', 'Inkurunziza', 'Meraneza', 'Ubumanzi'],
      Biryogo: ['Biryogo', 'Gabiro', 'Isoko', 'Umurimo'],
      Kiyovu: ['Amizero', 'Cercle', 'Ishema', 'Rugunga'],
    },
    Muhima: {
      Amahoro: ['Amahoro', 'Kabirizi', 'Ubumwe'],
      Kabasengerezi: ['Ikana', 'Intwari', 'Nyarurembo'],
      Ubumwe: ['Duterimbere', 'Isangano', 'Taba'],
    },
    Nyamirambo: {
      Cyivugiza: ['Amizero', 'Karisimbi', 'Muganza'],
      Gasharu: ['Kagunga', 'Rugarama', 'Urukundo'],
      Mumena: ['Irembo', 'Kiberinka', 'Mumena'],
    },
    Kimisagara: {
      Kamuhoza: ['Buhoro', 'Isano', 'Karama'],
      Katabaro: ['Amahoro', 'Kigabiro', 'Urugwiro'],
    },
  },
  Huye: {
    Ngoma: {
      Butare: ['Akaboti', 'Bukinanyana', 'Kaburemera', 'Karubanda'],
      Matyazo: ['Gahana', 'Kamucuzi', 'Rugarama'],
      Ngoma: ['Ngoma_I', 'Ngoma_II', 'Rwezamenyo'],
    },
    Tumba: {
      Cyarwa: ['Cyarwa_Cyimana', 'Cyarwa_Sumo', 'Mukoni'],
      Gitwa: ['Gasharu', 'Gitwa', 'Rango'],
      Mpare: ['Kigarama', 'Mpare', 'Taba'],
    },
    Huye: {
      Nyakagezi: ['Gahororo', 'Nyakagezi', 'Rugarama'],
      Rukira: ['Kagera', 'Rukira', 'Sovu'],
    },
  },
  Musanze: {
    Muhoza: {
      Cyabararika: ['Bukinanyana', 'Gashangiro', 'Kabaya'],
      Kigombe: ['Kigombe', 'Nduruma', 'Nyagisenyi'],
      Mpenge: ['Gihinga', 'Mpenge', 'Rukereza'],
      Ruhengeri: ['Byimana', 'Kabeza', 'Susa'],
    },
    Cyuve: {
      Bukinanyana: ['Gasharu', 'Kabeza', 'Nyamugari'],
      Kabeza: ['Kabeza', 'Karwasa', 'Rwebeya'],
    },
    Kinigi: {
      Bisoke: ['Kabazungu', 'Nyonirima', 'Sabyinyo'],
      Kaguhu: ['Kaguhu', 'Nyabigoma'],
    },
  },
  Rubavu: {
    Gisenyi: {
      Bugoyi: ['Amahoro', 'Isangano', 'Kivumu'],
      Kivumu: ['Byahi', 'Gacuba', 'Kivumu'],
      Mbugangari: ['Amajyambere', 'Mbugangari', 'Ubumwe'],
      Nengo: ['Gisa', 'Nengo', 'Umuganda'],
    },
    Rubavu: {
      Buhaza: ['Buhaza', 'Gikombe', 'Rukoko'],
      Byahi: ['Byahi', 'Kagano', 'Ngugo'],
    },
    Nyamyumba: {
      Busoro: ['Brasserie', 'Kinunu', 'Rubona'],
      Kiraga: ['Kiraga', 'Nyamyumba'],
    },
  },
  Muhanga: {
    Nyamabuye: {
      Gahogo: ['Gahogo', 'Kamugina', 'Ruli'],
      Gitarama: ['Gitarama', 'Kabeza', 'Nyarucyamu'],
      Remera: ['Biti', 'Kagarama', 'Remera'],
    },
    Cyeza: {
      Biringaga: ['Biringaga', 'Kivumu', 'Nyarubuye'],
    },
  },
  Rwamagana: {
    Kigabiro: {
      Cyanya: ['Cyanya', 'Gishari', 'Kigabiro'],
      Nyagasenyi: ['Bwana', 'Kadasumbwa', 'Nyagasenyi'],
      Sibagire: ['Kabeza', 'Sibagire', 'Taba'],
    },
    Muhazi: {
      Kabare: ['Kabare', 'Karitutu', 'Nyarubuye'],
      Kitazigurwa: ['Kitazigurwa', 'Rugarama'],
    },
  },
  Kayonza: {
    Mukarange: {
      Bwiza: ['Bwiza', 'Gasharu', 'Kayonza'],
      Mburabuturo: ['Kabarondo', 'Mburabuturo', 'Rusera'],
      Nyagatovu: ['Akabuga', 'Kigabiro', 'Nyagatovu'],
    },
    Kabarondo: {
      Cyabajwa: ['Cyabajwa', 'Kabarondo', 'Rusera'],
    },
  },
  Bugesera: {
    Nyamata: {
      Kanazi: ['Kanazi', 'Maranyundo', 'Nyamata_Ville'],
      Kayumba: ['Gahinga', 'Kayumba', 'Rugarama'],
      Nyamata_y_Umujyi: ['Gasenga', 'Gatare', 'Rukora'],
    },
    Ntarama: {
      Cyugaro: ['Cyugaro', 'Kanzenze', 'Kibungo'],
    },
  },
  Nyagatare: {
    Nyagatare: {
      Barija: ['Barija_A', 'Barija_B', 'Mirama'],
      Nyagatare: ['Gakirage', 'Nyagatare_I', 'Nyagatare_II'],
      Rutaraka: ['Karushuga', 'Rutaraka', 'Ryabega'],
    },
    Karangazi: {
      Ndama: ['Kamate', 'Ndama', 'Rwisirabo'],
    },
  },
  Rusizi: {
    Kamembe: {
      Cyangugu: ['Cyangugu', 'Gihundwe', 'Kamembe'],
      Gihundwe: ['Burunga', 'Gihundwe', 'Karambo'],
      Kamashangi: ['Kamashangi', 'Mont_Cyangugu', 'Murangi'],
    },
    Gihundwe: {
      Kamatita: ['Kamatita', 'Shagasha'],
    },
  },
  Karongi: {
    Bwishyura: {
      Gasharu: ['Gasharu', 'Kibuye', 'Kiniha'],
      Kibuye: ['Gacaca', 'Kibuye_Centre', 'Nyarusazi'],
      Kiniha: ['Kiniha', 'Rugarama'],
    },
  },
  Gicumbi: {
    Byumba: {
      Gacurabwenge: ['Byumba', 'Gacurabwenge', 'Nyamabuye'],
      Kibali: ['Kibali', 'Nyarutarama'],
      Nyakabungo: ['Gihanga', 'Nyakabungo'],
    },
  },
  Burera: {
    Cyanika: {
      Gisovu: ['Cyanika', 'Gisovu', 'Kagitega'],
      Kabyiniro: ['Kabyiniro', 'Kamanyana'],
    },
  },
  Gakenke: {
    Gakenke: {
      Kagoma: ['Gakenke', 'Kagoma', 'Rusagara'],
      Nganzo: ['Nganzo', 'Ruli'],
    },
  },
  Rulindo: {
    Base: {
      Cyohoha: ['Base', 'Cyohoha', 'Gitare'],
      Rwamahwa: ['Rwamahwa', 'Taba'],
    },
  },
  Kamonyi: {
    Runda: {
      Gihara: ['Gihara', 'Kabagesera', 'Ruyenzi'],
      Kagugu: ['Kagugu', 'Muganza'],
      Ruyenzi: ['Kigese', 'Nyamabuye', 'Ruyenzi'],
    },
  },
  Ruhango: {
    Ruhango: {
      Bunyogwe: ['Bunyogwe', 'Nyamagana', 'Ruhango'],
      Nyamagana: ['Gafunzo', 'Nyamagana'],
    },
  },
  Nyanza: {
    Busasamana: {
      Kavumu: ['Kavumu', 'Kigoma', 'Nyanza'],
      Nyanza: ['Gahondo', 'Nyanza_Centre', 'Rwesero'],
    },
  },
  Gisagara: {
    Ndora: {
      Bweya: ['Bweya', 'Cyamukuza', 'Ndora'],
      Gisagara: ['Gisagara', 'Mukande'],
    },
  },
  Nyamagabe: {
    Gasaka: {
      Kigeme: ['Gikongoro', 'Kigeme', 'Nyamagabe'],
      Nyamugari: ['Nyamugari', 'Nzega'],
    },
  },
  Nyaruguru: {
    Kibeho: {
      Kibeho: ['Kibeho', 'Mpanda', 'Nyange'],
    },
  },
  Ngoma: {
    Kibungo: {
      Cyasemakamba: ['Cyasemakamba', 'Kibungo', 'Karenge'],
      Gahima: ['Gahima', 'Kigabiro'],
    },
  },
  Kirehe: {
    Kirehe: {
      Gahama: ['Gahama', 'Kirehe', 'Nyamugari'],
      Nyarutunga: ['Nyarutunga', 'Rwantonde'],
    },
  },
  Gatsibo: {
    Kabarore: {
      Kabarore: ['Kabarore', 'Karambo', 'Simbwa'],
      Nyabikiri: ['Nyabikiri', 'Rugarama'],
    },
  },
  Ngororero: {
    Ngororero: {
      Kaseke: ['Kaseke', 'Mugano', 'Ngororero'],
      Rususa: ['Rususa', 'Sovu'],
    },
  },
  Nyabihu: {
    Mukamira: {
      Jaba: ['Jaba', 'Kanyove', 'Mukamira'],
      Rugeshi: ['Kintobo', 'Rugeshi'],
    },
  },
  Nyamasheke: {
    Kagano: {
      Gako: ['Gako', 'Kagano', 'Mubumbano'],
      Rwesero: ['Rwesero', 'Shangi'],
    },
  },
  Rutsiro: {
    Gihango: {
      Congo_Nil: ['Congo_Nil', 'Gihango', 'Mataba'],
      Shyembe: ['Kivumu', 'Shyembe'],
    },
  },
};

// Build complete location tree covering all 30 Districts & all 416 Sectors of Rwanda
export const RWANDA_LOCATIONS: RwandaLocationTree = Object.keys(ALL_SECTORS_BY_DISTRICT).reduce(
  (tree, district) => {
    const sectors = ALL_SECTORS_BY_DISTRICT[district] ?? [];
    const curatedDistrict = CURATED_CELLS_AND_VILLAGES[district] ?? {};
    const sectorMap: { [sector: string]: { [cell: string]: string[] } } = {};
    sectors.forEach((sector) => {
      sectorMap[sector] = curatedDistrict[sector] ?? {};
    });
    tree[district] = sectorMap;
    return tree;
  },
  {} as RwandaLocationTree,
);

export const RWANDA_DISTRICTS = Object.keys(RWANDA_LOCATIONS).sort();
