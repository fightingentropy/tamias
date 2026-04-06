type StaticAssetModule = {
  src: string;
  width?: number;
  height?: number;
};

declare module "*.jpg" {
  const asset: StaticAssetModule;
  export default asset;
}

declare module "*.mp4" {
  const asset: StaticAssetModule;
  export default asset;
}
