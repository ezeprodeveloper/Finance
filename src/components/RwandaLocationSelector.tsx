import { useState } from 'react';
import {
  RWANDA_DISTRICTS,
  RWANDA_DISTRICTS_BY_PROVINCE,
  RWANDA_LOCATIONS,
  RWANDA_PROVINCE_BY_DISTRICT,
  RWANDA_PROVINCES,
  RwandaProvince,
} from '../data/rwandaLocations';

interface RwandaLocationSelectorProps {
  province?: string;
  akarere: string;
  umurenge: string;
  akagari: string;
  umudugudu: string;
  required?: boolean;
  onChange: (next: {
    province: string;
    akarere: string;
    umurenge: string;
    akagari: string;
    umudugudu: string;
  }) => void;
}

export function RwandaLocationSelector({
  province = '',
  akarere,
  umurenge,
  akagari,
  umudugudu,
  required = false,
  onChange,
}: RwandaLocationSelectorProps) {
  const [customCellMode, setCustomCellMode] = useState(false);
  const [customVillageMode, setCustomVillageMode] = useState(false);

  const effectiveProvince =
    province || (akarere ? RWANDA_PROVINCE_BY_DISTRICT[akarere] ?? '' : '');

  const availableDistricts =
    effectiveProvince && effectiveProvince in RWANDA_DISTRICTS_BY_PROVINCE
      ? [...RWANDA_DISTRICTS_BY_PROVINCE[effectiveProvince as RwandaProvince]].sort()
      : RWANDA_DISTRICTS;

  const sectors =
    akarere && RWANDA_LOCATIONS[akarere]
      ? Object.keys(RWANDA_LOCATIONS[akarere]).sort()
      : [];

  const cells =
    akarere && umurenge && RWANDA_LOCATIONS[akarere]?.[umurenge]
      ? Object.keys(RWANDA_LOCATIONS[akarere][umurenge]).sort()
      : [];

  const villages =
    akarere &&
    umurenge &&
    akagari &&
    RWANDA_LOCATIONS[akarere]?.[umurenge]?.[akagari]
      ? [...RWANDA_LOCATIONS[akarere][umurenge][akagari]].sort()
      : [];

  const showCellInput = !umurenge ? false : cells.length === 0 || customCellMode || (Boolean(akagari) && !cells.includes(akagari));
  const showVillageInput = !akagari ? false : villages.length === 0 || customVillageMode || (Boolean(umudugudu) && !villages.includes(umudugudu));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="rw-province" className="block text-xs font-medium text-slate-700 mb-1">
            Province (Intara) {required ? '*' : '(Optional)'}
          </label>
          <select
            id="rw-province"
            value={effectiveProvince}
            required={required}
            onChange={(e) => {
              setCustomCellMode(false);
              setCustomVillageMode(false);
              onChange({
                province: e.target.value,
                akarere: '',
                umurenge: '',
                akagari: '',
                umudugudu: '',
              });
            }}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
          >
            <option value="">-- All 5 Provinces --</option>
            {RWANDA_PROVINCES.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rw-akarere" className="block text-xs font-medium text-slate-700 mb-1">
            District (Akarere) {required ? '*' : '(Optional)'}
          </label>
          <select
            id="rw-akarere"
            value={akarere}
            required={required}
            onChange={(e) => {
              const nextDist = e.target.value;
              const derivedProv = nextDist ? RWANDA_PROVINCE_BY_DISTRICT[nextDist] ?? effectiveProvince : effectiveProvince;
              setCustomCellMode(false);
              setCustomVillageMode(false);
              onChange({
                province: derivedProv,
                akarere: nextDist,
                umurenge: '',
                akagari: '',
                umudugudu: '',
              });
            }}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
          >
            <option value="">-- Select Akarere ({availableDistricts.length}) --</option>
            {availableDistricts.map((dist) => (
              <option key={dist} value={dist}>
                {dist}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rw-umurenge" className="block text-xs font-medium text-slate-700 mb-1">
            Sector (Umurenge) {required ? '*' : '(Optional)'}
          </label>
          <select
            id="rw-umurenge"
            value={umurenge}
            required={required}
            disabled={!akarere}
            onChange={(e) => {
              setCustomCellMode(false);
              setCustomVillageMode(false);
              onChange({
                province: effectiveProvince,
                akarere,
                umurenge: e.target.value,
                akagari: '',
                umudugudu: '',
              });
            }}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100"
          >
            <option value="">-- Select Umurenge ({sectors.length}) --</option>
            {sectors.map((sec) => (
              <option key={sec} value={sec}>
                {sec.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="rw-akagari" className="block text-xs font-medium text-slate-700">
              Cell (Akagari) {required ? '*' : '(Optional)'}
            </label>
            {cells.length > 0 && umurenge && (
              <button
                type="button"
                onClick={() => {
                  setCustomCellMode((v) => !v);
                  onChange({ province: effectiveProvince, akarere, umurenge, akagari: '', umudugudu: '' });
                }}
                className="text-[11px] font-semibold text-blue-800 hover:underline"
              >
                {showCellInput ? 'Choose from list' : 'Type manually'}
              </button>
            )}
          </div>
          {showCellInput ? (
            <input
              id="rw-akagari"
              type="text"
              value={akagari}
              required={required}
              disabled={!umurenge}
              onChange={(e) =>
                onChange({
                  province: effectiveProvince,
                  akarere,
                  umurenge,
                  akagari: e.target.value,
                  umudugudu,
                })
              }
              placeholder="Enter Cell (Akagari) name"
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100"
            />
          ) : (
            <select
              id="rw-akagari"
              value={akagari}
              required={required}
              disabled={!umurenge}
              onChange={(e) => {
                setCustomVillageMode(false);
                onChange({
                  province: effectiveProvince,
                  akarere,
                  umurenge,
                  akagari: e.target.value,
                  umudugudu: '',
                });
              }}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100"
            >
              <option value="">-- Select Akagari --</option>
              {cells.map((cell) => (
                <option key={cell} value={cell}>
                  {cell.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="rw-umudugudu" className="block text-xs font-medium text-slate-700">
              Village (Umudugudu) {required ? '*' : '(Optional)'}
            </label>
            {villages.length > 0 && akagari && (
              <button
                type="button"
                onClick={() => {
                  setCustomVillageMode((v) => !v);
                  onChange({ province: effectiveProvince, akarere, umurenge, akagari, umudugudu: '' });
                }}
                className="text-[11px] font-semibold text-blue-800 hover:underline"
              >
                {showVillageInput ? 'Choose from list' : 'Type manually'}
              </button>
            )}
          </div>
          {showVillageInput ? (
            <input
              id="rw-umudugudu"
              type="text"
              value={umudugudu}
              required={required}
              disabled={!akagari}
              onChange={(e) =>
                onChange({
                  province: effectiveProvince,
                  akarere,
                  umurenge,
                  akagari,
                  umudugudu: e.target.value,
                })
              }
              placeholder="Enter Village (Umudugudu) name"
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100"
            />
          ) : (
            <select
              id="rw-umudugudu"
              value={umudugudu}
              required={required}
              disabled={!akagari}
              onChange={(e) =>
                onChange({
                  province: effectiveProvince,
                  akarere,
                  umurenge,
                  akagari,
                  umudugudu: e.target.value,
                })
              }
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100"
            >
              <option value="">-- Select Umudugudu --</option>
              {villages.map((vil) => (
                <option key={vil} value={vil}>
                  {vil.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
