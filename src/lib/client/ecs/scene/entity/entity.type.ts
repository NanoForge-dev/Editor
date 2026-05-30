export interface Entity {
  id: string;
  name: string;
  treePath: string;
  components: Record<string, Record<string, string>>;
}
