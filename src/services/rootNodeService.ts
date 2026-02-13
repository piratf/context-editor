import type { NodeData } from "../types/nodeData";
import { GetChildrenResult } from "./nodeService";

export interface RootNodeService {
  createRootNodes(): readonly NodeData[];
  getRootNodeChildren(node: NodeData): Promise<GetChildrenResult>;
}