import { treeSeedKey } from '../model/seededRandom';
import { ForestTree, GrowingTree } from '../model/treeTypes';
import PixelTree from './PixelTree';

interface ForestModalProps {
  forest: ForestTree[];
  growing: GrowingTree;
  onClose: () => void;
  userId: string;
}

const ForestModal = ({ forest, growing, onClose, userId }: ForestModalProps) => (
  <div className="modal-backdrop" onClick={onClose} role="presentation">
    <div className="forest-modal" onClick={event => event.stopPropagation()}>
      <header className="forest-modal-head">
        <h2>나의 숲</h2>
        <button aria-label="닫기" onClick={onClose} type="button">
          ×
        </button>
      </header>

      <div className="forest-grid">
        {forest.map(tree => (
          <div className="forest-tree-card" key={tree.id}>
            <PixelTree
              params={tree.final_params}
              seed={treeSeedKey(userId, tree.generation)}
              size={96}
            />
            <span className="forest-tree-date">{tree.planted_at.slice(0, 10)}</span>
            <span className="forest-tree-meta">
              완료 {tree.completed_todo_count} · 물 {tree.completed_day_count}
            </span>
          </div>
        ))}
        <div className="forest-tree-card growing">
          <PixelTree params={growing.params} seed={growing.seed} size={96} />
          <span className="forest-tree-date">성장 중</span>
        </div>
      </div>

      <p className="forest-modal-note">마친 하루들이 이곳에 숲을 만들었습니다.</p>
    </div>
  </div>
);

export default ForestModal;
