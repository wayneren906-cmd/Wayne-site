import type {Entry} from '../lib/records';

// Only confirmed public entries belong here. Dates must not duplicate legacy records.
export const journalEntries:Entry[]=[
  {
    date:'2026-11-08',
    items:[
      {label:'STM32 I²C 学习与 SPI 彩屏驱动实践',text:'今天学习了 I²C 通信，并在 NUCLEO-F446RE 上完成 SPI 彩屏显示与交互实验。'},
      {label:'I²C 通信',text:'观看教程，学习了 SDA、SCL、起始与停止信号、ACK/NACK、设备地址和上拉电阻，并用 STM32CubeMX 将 I2C1 配置到 PB8、PB9。连接 SHT3X-DIS 温湿度传感器时发现芯片异常发热；用万用表初步排查后，未发现明显低阻短路。实机实验已暂停，准备更换传感器后继续。'},
      {label:'SPI 彩屏',text:'使用 NUCLEO-F446RE 驱动 1.77 英寸 ST7735S TFT 彩屏，完成 SPI1、GPIO 和时钟配置，解决了 PA5 引脚冲突及工程编译问题。学习了 SPI Mode 0、预分频、片选以及命令和数据传输，并成功显示 RGB565 红、绿、蓝三色循环。'},
      {label:'WAYNE OS v1.0',text:'在 AI 辅助下，基于 ST7735S 运行了一个简单图形界面，实现开机动画、文字、运行时间、动态模拟波形和八通道柱状图，并用 B1 按键切换两个页面。演示功能已通过实机运行验证。'},
      {label:'遇到的问题',text:'SHT3X 模块异常发热，I²C 实机验证尚未完成。CubeMX 默认引脚配置与 SPI1 有冲突；初次生成独立外设文件时遇到头文件缺失。彩屏 LEDA 背光直接连接 3.3V，限流电路仍需确认。'},
      {label:'今日收获',text:'完成了 SPI 从外设配置、硬件接线、HAL 通信到图形显示的实践，熟悉了 ST7735S 的基本驱动流程。对代码内部实现和工程组织方式，还需要进一步理解。'},
      {label:'下一步',text:'将 ST7735S 驱动模块化，学习 SPI DMA 和刷新性能优化；更换传感器后继续 I²C 实机实验，再尝试把真实传感器数据接入彩屏。'},
      {label:'记录状态',text:'I²C：原理已学习，实机待完成。SPI：基础实验已完成。WAYNE OS v1.0：演示功能已完成。'},
    ],
    practice:'I²C 传感器实验因芯片异常发热暂停；SPI 彩屏的三色显示与 WAYNE OS 双页面演示已实机运行。',
    revision:2,
    updatedAt:'2026-11-08T16:32:24Z',
  },
];
