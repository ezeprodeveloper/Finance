export interface RwandaLocationTree {
  [district: string]: {
    [sector: string]: {
      [cell: string]: string[];
    };
  };
}

export const RWANDA_LOCATIONS: RwandaLocationTree = {
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

export const RWANDA_DISTRICTS = Object.keys(RWANDA_LOCATIONS).sort();
