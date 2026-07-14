import { seededRandom, treeSeedKey } from '../model/seededRandom';
import { ForestTree, GrowingTree } from '../model/treeTypes';
import PixelTree from './PixelTree';

interface ForestModalProps {
  forest: ForestTree[];
  growing: GrowingTree;
  onClose: () => void;
  userId: string;
}

// Deterministic "planted" spot per tree: same seed → same spot on every
// render and device. `top` doubles as the depth cue (lower = nearer = bigger).
const treeFieldPosition = (seed: string) => {
  const rng = seededRandom(`${seed}:forest-pos`);
  const left = 8 + rng() * 84;
  const top = 32 + rng() * 58;
  return { left, size: Math.round(52 + (top - 32) * 0.7), top };
};

const ForestModal = ({ forest, growing, onClose, userId }: ForestModalProps) => (
  <div className="modal-backdrop" onClick={onClose} role="presentation">
    <div className="forest-modal" onClick={event => event.stopPropagation()}>
      <header className="forest-modal-head">
        <h2>나의 숲</h2>
        <button aria-label="닫기" onClick={onClose} type="button">
          ×
        </button>
      </header>

      <div className="forest-field">
        {forest.map(tree => {
          const seed = treeSeedKey(userId, tree.generation);
          const position = treeFieldPosition(seed);
          return (
            <div
              className="forest-field-tree"
              key={tree.id}
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                zIndex: Math.round(position.top),
              }}
              title={`${tree.planted_at.slice(0, 10)} · 완료 ${tree.completed_todo_count} · 물 ${tree.completed_day_count}`}
            >
              <PixelTree params={tree.final_params} seed={seed} size={position.size} />
            </div>
          );
        })}
        {(() => {
          const position = treeFieldPosition(growing.seed);
          return (
            <div
              className="forest-field-tree growing"
              style={{
                left: `${position.left}%`,
                top: `${position.top}%`,
                zIndex: Math.round(position.top),
              }}
              title="성장 중"
            >
              <PixelTree params={growing.params} seed={growing.seed} size={position.size} />
              <span className="forest-tree-date">성장 중</span>
            </div>
          );
        })()}
      </div>

      <p className="forest-modal-note">마친 하루들이 이곳에 숲을 만들었습니다.</p>
    </div>
  </div>
);

export default ForestModal;
