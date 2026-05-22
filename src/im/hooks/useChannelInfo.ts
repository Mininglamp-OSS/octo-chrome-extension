import { useEffect, useState } from "react";
import { Channel, WKSDK } from "wukongimjssdk";
import { ChannelType } from "@/const/channel";

export interface ChannelInfoView {
  name?: string;
  avatar?: string;
}

/**
 * 订阅 SDK channelManager 拿一个 uid 对应的 ChannelInfo（默认 person 渠道）。
 * - 同步先取 cache（命中则首屏无闪烁）
 * - 没命中则 fetchChannelInfo 异步触发（SDK 内部走我们在 client.ts 配的 channelInfoCallback）
 * - 订阅 channelManager listener，info 到来时更新本组件
 *
 * 主要用法：合并转发详情面板里给 sub.fromUid 拉头像 / 名称（payload users 里只有 name 没头像）。
 */
export function useChannelInfo(
  uid: string,
  channelType: number = ChannelType.person,
): ChannelInfoView {
  const [view, setView] = useState<ChannelInfoView>(() => readCache(uid, channelType));

  useEffect(() => {
    if (!uid) return;
    const sdk = WKSDK.shared();
    const target = new Channel(uid, channelType);

    // 首次进来再同步一次：避免上一次 uid prop 切换时 setState 滞后
    setView(readCache(uid, channelType));

    const cached = sdk.channelManager.getChannelInfo(target);
    if (!cached) {
      void sdk.channelManager.fetchChannelInfo(target);
    }

    const listener = (info: { channel: Channel; title?: string; logo?: string }) => {
      if (!info?.channel) return;
      if (info.channel.channelID !== uid || info.channel.channelType !== channelType) return;
      setView({
        ...(info.title && { name: info.title }),
        ...(info.logo && { avatar: info.logo }),
      });
    };
    sdk.channelManager.addListener(listener);
    return () => {
      sdk.channelManager.removeListener(listener);
    };
  }, [uid, channelType]);

  return view;
}

function readCache(uid: string, channelType: number): ChannelInfoView {
  if (!uid) return {};
  const info = WKSDK.shared().channelManager.getChannelInfo(new Channel(uid, channelType));
  if (!info) return {};
  return {
    ...(info.title && { name: info.title }),
    ...(info.logo && { avatar: info.logo }),
  };
}
