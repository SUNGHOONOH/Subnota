import { useEffect, useRef, useState } from 'react';

import { GrowingTree, TreeStage } from '../model/treeTypes';
import PixelTree from './PixelTree';

const STAGE_MESSAGE: Record<TreeStage, string> = {
  seed: '새로운 씨앗이 기다리고 있습니다.',
  sprout: '싹이 텄습니다.',
  seedling: '나무가 자라고 있습니다.',
  young_tree: '제법 나무다워졌습니다.',
  mature_tree: '한 그루의 나무가 충분히 자랐습니다. 준비되면 숲에 심을 수 있습니다.',
};

interface TreeCardProps {
  forestCount: number;
  onOpenForest: () => void;
  onPlant: () => void;
  tree: GrowingTree;
  // Bumps when a whole day is freshly completed this session (never on load),
  // so the watering plays once and is not replayed on restart.
  wateringSignal: number;
}

const TreeCard = ({ forestCount, onOpenForest, onPlant, tree, wateringSignal }: TreeCardProps) => {
  const [watering, setWatering] = useState(false);
  const seen = useRef(wateringSignal);

  useEffect(() => {
    if (wateringSignal !== seen.current) {
      seen.current = wateringSignal;
      if (wateringSignal > 0) {
        setWatering(true);
        const timer = setTimeout(() => setWatering(false), 1300);
        return () => clearTimeout(timer);
      }
    }
  }, [wateringSignal]);

  return (
    <div className="tree-card">
      <div className={`tree-card-canvas${watering ? ' watering' : ''}`}>
        <PixelTree params={tree.params} seed={tree.seed} size={140} />
        {watering && <span className="tree-water-drop" aria-hidden />}
      </div>
      <p className="tree-card-message">{STAGE_MESSAGE[tree.params.stage]}</p>
      <div className="tree-card-actions">
        {tree.isMature && (
          <button className="tree-plant-btn" onClick={onPlant} type="button">
            숲에 심기
          </button>
        )}
        <button className="tree-forest-btn" onClick={onOpenForest} type="button">
          숲 {forestCount}
        </button>
      </div>
    </div>
  );
};

export default TreeCard;
