export interface AddCommunityFormProps {
  communityName: string;
  onCommunityNameChange: (name: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}

/**
 * The ✚ new-community form. Copy, class names and the Enter/Escape keys are
 * unchanged — this is the markup App used to render inline, and `App` still owns
 * whether it is shown at all, because the empty state next to it reads the same
 * flag.
 */
export function AddCommunityForm({
  communityName,
  onCommunityNameChange,
  onCreate,
  onCancel,
}: AddCommunityFormProps) {
  return (
    <div className="add-community">
      <div className="form-label">New community</div>
      <div className="form-row">
        <input
          type="text"
          value={communityName}
          onChange={(e) => onCommunityNameChange(e.target.value)}
          placeholder="e.g. Sunday League"
          onKeyDown={(e) => {
            if (e.key === "Enter") onCreate();
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <button className="btn btn-primary" onClick={onCreate}>Create</button>
        <button className="btn btn-ghost" onClick={onCancel} aria-label="Cancel">Cancel</button>
      </div>
    </div>
  );
}
