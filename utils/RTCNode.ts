/**
 * RTC节点封装工具类
 */
export class RTCNode {
  private pc: RTCPeerConnection
  private mediaStream: MediaStream
  private dataChunnel: RTCDataChannel | undefined
  public onSDP: (sdp: RTCSessionDescriptionInit) => void = () => {}
  public onICECandidate: (candidate: RTCIceCandidate) => void = () => {}
  public onError: (e: any) => void = () => {}
  public onConnected: () => void = () => {}
  public onDispose: () => void = () => {}

  constructor(iceServers: RTCIceServer[] | undefined = undefined) {
    this.mediaStream = new MediaStream()
    // 初始化
    this.pc = new RTCPeerConnection({ iceServers: iceServers })
    this.pc.onnegotiationneeded = () => this.reNegotition()
    this.pc.onicecandidate = (e) => (e.candidate ? this.onICECandidate(e.candidate) : undefined)
    this.pc.onicecandidateerror = this.onError
    // 收到媒体流
    this.pc.ontrack = (e) => {
      const track = e?.track
      if (track) {
        track.onmute = () => {
          this.mediaStream.removeTrack(track)
          track.stop()
        }
        this.mediaStream.addTrack(track)
      }
    }
    this.pc.onconnectionstatechange = () => {
      if (['closed', 'disconnected', 'failed'].includes(this.pc.connectionState)) {
        this.dispose()
        this.onDispose()
      } else if (this.pc.connectionState === 'connected') {
        this.onConnected()
      }
    }
  }

  /**
   * 重协商SDP
   */
  private async reNegotition() {
    return this.pc
      .createOffer()
      .then((offer) => this.pc.setLocalDescription(offer))
      .then(() => (this.pc.localDescription ? this.onSDP(this.pc.localDescription) : undefined))
      .catch((e) => {
        console.error(e)
        this.onError(e)
        this.dispose()
      })
  }

  /**
   * 更新要发送的媒体流
   * @param stream 媒体流
   */
  public updateStream(stream: MediaStream) {
    this.pc.getSenders().forEach((sender) => {
      this.pc.removeTrack(sender)
      sender.track?.stop()
    })
    stream.getTracks().forEach((track) => this.pc.addTrack(track))
  }

  /**
   * 设置远端SDP
   * @param sdp 会话描述
   */
  public async setRemoteSDP(sdp: RTCSessionDescriptionInit) {
    return this.pc
      .setRemoteDescription(sdp)
      .then(() => (sdp?.type === 'offer' ? this.pc.createAnswer() : undefined))
      .then(async (anwser) => {
        if (anwser) {
          await this.pc.setLocalDescription(anwser)
          this.onSDP(anwser)
        }
      })
      .catch((e) => {
        console.error(e)
        this.onError(e)
        this.dispose()
      })
  }

  /**
   * 添加ICE服务候选
   * @param candidate ICE服务候选
   */
  public async addICECandidate(candidate: RTCIceCandidateInit) {
    return this.pc.addIceCandidate(candidate)
  }

  /**
   * 获取接收到的媒体流
   * @returns 媒体流
   */
  public getMediaStream() {
    return this.mediaStream
  }

  /**
   * 获取数据通道，没有则创建
   * @returns 数据通道
   */
  public getDataChunnel() {
    if (!this.dataChunnel) {
      this.dataChunnel = this.pc.createDataChannel('dataChunnel')
    }
    return this.dataChunnel
  }

  /**
   * 获取统计信息
   * @returns 统计信息
   */
  public async getInfo() {
    return this.pc
      .getStats()
      .then((states: RTCStatsReport) => {
        const info = {
          bytesSent: 0,
          bytesReceived: 0,
          local: {
            address: '',
            port: 0,
            protocol: '',
            candidateType: ''
          },
          remote: {
            address: '',
            port: 0,
            protocol: '',
            candidateType: ''
          }
        }
        for (const state of states.values()) {
          if (state.type === 'transport') {
            info.bytesSent = state?.bytesSent
            info.bytesReceived = state?.bytesReceived
            const selectedCandidatePair = states.get(state?.selectedCandidatePairId)
            const localCandidate = states.get(selectedCandidatePair?.localCandidateId)
            info.local.address = localCandidate?.address
            info.local.port = localCandidate?.port
            info.local.protocol = localCandidate?.protocol
            info.local.candidateType = localCandidate?.candidateType
            const remoteCandidate = states.get(selectedCandidatePair?.remoteCandidateId)
            info.remote.address = remoteCandidate?.address
            info.remote.port = remoteCandidate?.port
            info.remote.protocol = remoteCandidate?.protocol
            info.remote.candidateType = remoteCandidate?.candidateType
            break
          }
        }
        return info
      })
      .catch(this.onError)
  }

  /**
   * 判断是否已连接
   * @returns 为 true 则已连接，否则未连接
   */
  public isConnected() {
    return this.pc.connectionState === 'connected'
  }

  /**
   * 销毁节点并清理资源
   */
  public dispose() {
    // 停止发送的媒体轨道
    this.pc.getSenders().forEach((sender) => sender?.track?.stop())

    // 停止接收的媒体轨道
    this.pc.getReceivers().forEach((receiver) => receiver?.track?.stop())

    // 关闭数据通道
    this.dataChunnel?.close()

    // 移除所有的事件监听器
    this.pc.onicecandidate = null
    this.pc.ontrack = null
    this.pc.ondatachannel = null
    this.pc.oniceconnectionstatechange = null
    this.pc.onsignalingstatechange = null
    this.pc.onicegatheringstatechange = null
    this.pc.onnegotiationneeded = null
    this.pc.close()
  }
}
