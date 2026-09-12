import { MAP_LAYER_LABELS, MAP_LAYER_ORDER, type MapLayerKey, type MapLayerVisibility } from "@/lib/mapLayers";
import OverviewPanel from "./OverviewPanel";

interface LayerControlPanelProps {
  layers: MapLayerVisibility;
  onToggle: (key: MapLayerKey) => void;
}

export default function LayerControlPanel({ layers, onToggle }: LayerControlPanelProps) {
  return (
    <OverviewPanel title="Map Layers">
      <ul className="layer-toggle-list">
        {MAP_LAYER_ORDER.map((key) => {
          const on = layers[key];
          return (
            <li key={key} className="layer-toggle-row">
              <span className="layer-toggle-label">{MAP_LAYER_LABELS[key]}</span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={MAP_LAYER_LABELS[key]}
                className={`layer-toggle-switch ${on ? "layer-toggle-switch-on" : ""}`}
                onClick={() => onToggle(key)}
              >
                <span className="layer-toggle-knob" />
              </button>
            </li>
          );
        })}
      </ul>
    </OverviewPanel>
  );
}
