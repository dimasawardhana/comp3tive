import { useState, type Dispatch, type SetStateAction } from "react";
import type { Community } from "../domain/types";

/**
 * The ✚ new-community form's state and handlers. Visibility is deliberately not
 * private to the form: `AppChrome` owns the ✚ button that toggles it, and App
 * reads it in the no-communities empty state, so both name the same flag rather
 * than one of them keeping a second copy.
 */
export interface AddCommunityFlow {
  showAddCommunity: boolean;
  /** The raw setter, not a `toggle`: `AppChrome` calls it with no argument, so
   *  the toggling arrow stays App's, exactly as it was before this hook. */
  setShowAddCommunity: Dispatch<SetStateAction<boolean>>;
  communityName: string;
  setCommunityName: (name: string) => void;
  createCommunity: () => Promise<void>;
  cancelAddCommunity: () => void;
}

/**
 * App's single call site for the new-community form. `create` arrives as a
 * dependency rather than a `useCommunities()` call so this hook holds no store
 * and the app keeps exactly one community list.
 */
export function useAddCommunity(create: (name: string) => Promise<Community>): AddCommunityFlow {
  const [communityName, setCommunityName] = useState("");
  const [showAddCommunity, setShowAddCommunity] = useState(false);

  const createCommunity = async () => {
    if (!communityName.trim()) return;
    await create(communityName.trim());
    setCommunityName("");
    setShowAddCommunity(false);
  };

  const cancelAddCommunity = () => {
    setCommunityName("");
    setShowAddCommunity(false);
  };

  return {
    showAddCommunity,
    setShowAddCommunity,
    communityName,
    setCommunityName,
    createCommunity,
    cancelAddCommunity,
  };
}
