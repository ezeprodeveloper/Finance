import { RWANDA_DISTRICTS, RWANDA_LOCATIONS } from '../data/rwandaLocations';

interface RwandaLocationSelectorProps {
  akarere: string;
  umurenge: string;
  akagari: string;
  umudugudu: string;
  required?: boolean;
  onChange: (next: {
    akarere: string;
    umurenge: string;
    akagari: string;
    umudugudu: string;
  }) => void;
}

export function RwandaLocationSelector({
  akarere,
  umurenge,
  akagari,
  umudugudu,
  required = false,
  onChange,
}: RwandaLocationSelectorProps) {
  const sectors = akarere && RWANDA_LOCATIONS[akarere]
    ? Object.keys(RWANDA_LOCATIONS[akarere]).sort()
    : [];

  const cells = akarere && umurenge && RWANDA_LOCATIONS[akarere]?.[umurenge]
    ? Object.keys(RWANDA_LOCATIONS[akarere][umurenge]).sort()
    : [];

  const villages =
    akarere &&
    umurenge &&
    akagari &&
    RWANDA_LOCATIONS[akarere]?.[umurenge]?.[akagari]
      ? [...RWANDA_LOCATIONS[akarere][umurenge][akagari]].sort()
      : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <div>
        <label htmlFor="rw-akarere" className="block text-xs font-medium text-slate-700 mb-1">
          District (Akarere) {required ? '*' : '(Optional)'}
        </label>
        <select
          id="rw-akarere"
          value={akarere}
          required={required}
          onChange={(e) =>
            onChange({
              akarere: e.target.value,
              umurenge: '',
              akagari: '',
              umudugudu: '',
            })
          }
          className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
        >
          <option value="">-- Select Akarere --</option>
          {RWANDA_DISTRICTS.map((dist) => (
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
          onChange={(e) =>
            onChange({
              akarere,
              umurenge: e.target.value,
              akagari: '',
              umudugudu: '',
            })
          }
          className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100"
        >
          <option value="">-- Select Umurenge --</option>
          {sectors.map((sec) => (
            <option key={sec} value={sec}>
              {sec.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="rw-akagari" className="block text-xs font-medium text-slate-700 mb-1">
          Cell (Akagari) {required ? '*' : '(Optional)'}
        </label>
        <select
          id="rw-akagari"
          value={akagari}
          required={required}
          disabled={!umurenge}
          onChange={(e) =>
            onChange({
              akarere,
              umurenge,
              akagari: e.target.value,
              umudugudu: '',
            })
          }
          className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100"
        >
          <option value="">-- Select Akagari --</option>
          {cells.map((cell) => (
            <option key={cell} value={cell}>
              {cell.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="rw-umudugudu" className="block text-xs font-medium text-slate-700 mb-1">
          Village (Umudugudu) {required ? '*' : '(Optional)'}
        </label>
        <select
          id="rw-umudugudu"
          value={umudugudu}
          required={required}
          disabled={!akagari}
          onChange={(e) =>
            onChange({
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
      </div>
    </div>
  );
}
