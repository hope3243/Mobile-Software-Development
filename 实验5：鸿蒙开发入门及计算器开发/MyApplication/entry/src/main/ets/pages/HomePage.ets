/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 */

import Logger from '../common/util/Logger';
import CalculateUtil from '../common/util/CalculateUtil';
import CheckEmptyUtil from '../common/util/CheckEmptyUtil';
import keysModel from '../viewmodel/PresskeysViewModel';
import { PressKeyItem } from '../viewmodel/PressKeysItem';
import { CommonConstants, Symbol } from '../common/constants/CommonConstants';
import { common } from '@kit.AbilityKit';

PersistentStorage.persistProp<Array<string>>('calculatorHistory', []);
PersistentStorage.persistProp<number>('calculatorMemory', 0);
PersistentStorage.persistProp<number>('calculatorTheme', 0);

@Entry
@Component
struct HomePage {
  @State @Watch('inputValueChange') inputValue: string = '';
  @State calValue: string = '';
  @State isScientific: boolean = false;
  @State showHistory: boolean = false;
  @State showConverter: boolean = false;
  @State showDateCalculator: boolean = false;
  @State showMoreMenu: boolean = false;
  @State scientificPage: number = 0;
  @State dateBetweenMode: boolean = true;
  @State startDate: Date = new Date();
  @State endDate: Date = new Date();
  @State inverseMode: boolean = false;
  @State angleInDegree: boolean = true;
  @State pressedKey: string = '';
  @State resultOpacity: number = 1;
  @State resultOffset: number = 0;
  @State cursorVisible: boolean = true;
  @StorageLink('calculatorHistory') historyRecords: Array<string> = [];
  @StorageLink('calculatorMemory') memoryValue: number = 0;
  @StorageLink('calculatorTheme') themeIndex: number = 0;
  private expressions: Array<string> = [];
  private memoryKeys: Array<string> = ['MC', 'M+', 'M-', 'MR'];
  private cursorTimer: number = -1;
  private inputScroller: Scroller = new Scroller();
  // 按 3 行 × 6 列布局：单页铺开 18 键；三角函数/对数/开方一行，幂/根/阶乘一行，括号/常数/控制一行
  private scientificKeys: Array<string> = [
    'sin', 'cos', 'tan', 'ln', 'log', '√',
    'x²', 'x³', '1/x', 'xʸ', 'ʸ√x', 'x!',
    '(', ')', 'e', 'π', 'Inv', 'Rad'
  ];
  private themeColors: Array<string> = ['#3478F6', '#7C4DFF', '#00A86B', '#F26A2E'];
  private themeLightColors: Array<string> = ['#EEF4FF', '#F3EEFF', '#EAF8F1', '#FFF1E9'];
  private converterCategories: Array<string> = ['长度', '质量', '温度', '面积', '体积', '存储'];
  private converterKeys: Array<string> = [
    '7', '8', '9', 'del', '4', '5', '6', 'C',
    '1', '2', '3', '±', '0', '.', '交换', '完成'
  ];
  @State converterCategoryIndex: number = 0;
  @State converterFromIndex: number = 0;
  @State converterToIndex: number = 1;
  @State converterInput: string = '';
  @State lastBtnIsEqu: boolean = false;
  uiContext = this.getUIContext();
  @StorageLink('topRectHeight') topRectHeight: number = 0;
  @StorageLink('bottomRectHeight') bottomRectHeight: number = 0;

  // 自定义键盘（宽高设为0）
  @Builder
  CustomKeyboardBuilder() {
    Column() {
      Grid() {
        // 键盘内容（实际不可见）
      }
      .height(0)
      .width(0);
    };
  }

  @Builder
  ScientificKeyGrid(keys: Array<string>) {
    Grid() {
      ForEach(keys, (key: string) => {
        GridItem() {
          Text(this.scienceKeyLabel(key))
            .fontSize(15)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.isScienceToggleActive(key) ? Color.White : this.primaryColor())
            .textAlign(TextAlign.Center)
            .width('100%')
            .height('100%');
        }
            .height(38)
            .borderRadius(15)
        .backgroundColor(this.isScienceToggleActive(key) ? this.primaryColor() : '#F8FAFE')
        .shadow({ radius: 6, color: 'rgba(45, 66, 96, 0.12)', offsetY: 2 })
        .scale({ x: this.pressedKey === key ? 0.94 : 1, y: this.pressedKey === key ? 0.94 : 1 })
        .animation({ duration: 110, curve: Curve.EaseOut })
        .onTouch((event: TouchEvent) => this.handleTouch(event, key))
        .onClick(() => this.applyScientificFunction(key));
      }, (key: string) => key);
    }
    .columnsTemplate('1fr 1fr 1fr 1fr 1fr 1fr')
    .columnsGap(8)
    .rowsGap(8)
    .height(130)
    .width('100%');
  }

  inputValueChange() {
    let formattedValue = this.resultFormat(this.inputValue);
    if (formattedValue !== this.inputValue) {
      this.inputValue = formattedValue;
    }
    setTimeout(() => {
      this.inputScroller.scrollEdge(Edge.End);
    }, 0);
  }

  inputFontSize(): number {
    let baseSize = this.isScientific ? 38 : 48;
    let minSize = this.isScientific ? 24 : 26;
    let shrinkStart = this.isScientific ? 8 : 9;
    let extraLength = Math.max(0, this.inputValue.length - shrinkStart);
    return Math.max(minSize, baseSize - extraLength * 2);
  }

  previewFontSize(): number {
    let extraLength = Math.max(0, this.calValue.length - 13);
    return Math.max(16, 25 - extraLength);
  }

  aboutToAppear(): void {
    this.cursorTimer = setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
    }, 520);
  }

  aboutToDisappear(): void {
    if (this.cursorTimer !== -1) {
      clearInterval(this.cursorTimer);
    }
  }

  animateResult(): void {
    this.resultOpacity = 0.18;
    this.resultOffset = 30;
    this.uiContext.animateTo({ duration: 210, curve: Curve.EaseOut }, () => {
      this.resultOpacity = 1;
      this.resultOffset = -5;
    });
    setTimeout(() => {
      this.uiContext.animateTo({ duration: 110, curve: Curve.EaseIn }, () => {
        this.resultOffset = 0;
      });
    }, 210);
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Column() {
        Stack() {
          Row() {
            Row() {
              Text('标准')
                .fontSize(14)
                .fontWeight(this.isScientific ? FontWeight.Regular : FontWeight.Bold)
                .fontColor(this.isScientific ? '#667085' : Color.White)
                .textAlign(TextAlign.Center)
                .width(56)
                .height(32)
                .borderRadius(16)
                .backgroundColor(this.isScientific ? Color.Transparent : this.primaryColor())
                .onClick(() => this.switchMode(false));
              Text('科学')
                .fontSize(14)
                .fontWeight(this.isScientific ? FontWeight.Bold : FontWeight.Regular)
                .fontColor(this.isScientific ? Color.White : '#667085')
                .textAlign(TextAlign.Center)
                .width(56)
                .height(32)
                .borderRadius(16)
                .backgroundColor(this.isScientific ? this.primaryColor() : Color.Transparent)
                .onClick(() => this.switchMode(true));
            }
            .padding(2)
            .borderRadius(18)
            .backgroundColor('#EEF2F7');

            Blank();

            Column({ space: 3 }) {
              Text('•')
                .fontSize(8)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.primaryColor());
              Text('•')
                .fontSize(8)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.primaryColor());
              Text('•')
                .fontSize(8)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.primaryColor());
            }
            .width(34)
            .height(34)
            .borderRadius(17)
            .backgroundColor(this.themeLightColor())
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)
            .rotate({ angle: this.showMoreMenu ? 90 : 0, centerX: '50%', centerY: '50%' })
            .animation({ duration: 180, curve: Curve.EaseOut })
            .onClick(() => {
              this.showMoreMenu = !this.showMoreMenu;
            });
          }
          .width('100%')
          .height(56)
          .padding({ left: 14, right: 14 })
          .justifyContent(FlexAlign.SpaceBetween)
          .alignItems(VerticalAlign.Center);

          Text('计算器')
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor('#172033');
        }
        .width('100%')
        .height(56)
        .margin({ top: this.uiContext.px2vp(this.topRectHeight) });

        Column() {
          Scroll(this.inputScroller) {
            Row() {
              Text(this.resultFormat(this.inputValue))
                .fontSize(this.inputFontSize())
                .lineHeight(this.isScientific ? 48 : 64)
                .maxLines(1)
                .fontColor('#172033')
                .textAlign(TextAlign.End);
              if (!this.lastBtnIsEqu) {
                Text('|')
                  .fontSize(this.inputFontSize())
                  .fontWeight(FontWeight.Lighter)
                  .fontColor(this.primaryColor())
                  .opacity(this.cursorVisible ? 1 : 0)
                  .margin({ left: 1 });
              }
            }
            .constraintSize({ minWidth: '100%' })
            .height('100%')
            .padding({ right: 12 })
            .justifyContent(FlexAlign.End)
            .alignItems(VerticalAlign.Center);
          }
          .width('100%')
          .height(this.isScientific ? 56 : 102)
          .scrollable(ScrollDirection.Horizontal)
          .scrollBar(BarState.Off)
          .opacity(this.resultOpacity)
          .translate({ y: this.resultOffset });
          Text(this.resultFormat(this.calValue))
            .fontSize(this.previewFontSize())
            .fontWeight(FontWeight.Medium)
            .fontColor('#667085')
            .margin({ right: 12 })
            .width('100%')
            .textAlign(TextAlign.End)
            .maxLines(1);
        }
        .width('100%')
        .height(this.isScientific ? 96 : 174)
        .padding({ left: 16, right: 16, top: 4, bottom: this.isScientific ? 10 : 18 })
        .alignItems(HorizontalAlign.End)
        .justifyContent(FlexAlign.Center)
        .animation({ duration: 220, curve: Curve.EaseOut });

        Row() {
          ForEach(this.memoryKeys, (key: string) => {
            Text(key)
              .fontSize(15)
              .fontWeight(FontWeight.Bold)
              .fontColor(key === 'MC' && this.memoryValue === 0 ? '#AAB1BD' : this.primaryColor())
              .textAlign(TextAlign.Center)
              .width(68)
              .height(34)
              .borderRadius(17)
.backgroundColor(this.themeLightColor())
                .shadow({ radius: 5, color: 'rgba(45, 66, 96, 0.11)', offsetY: 2 })
              .scale({ x: this.pressedKey === key ? 0.92 : 1, y: this.pressedKey === key ? 0.92 : 1 })
              .animation({ duration: 105, curve: Curve.EaseOut })
              .onTouch((event: TouchEvent) => this.handleTouch(event, key))
              .onClick(() => this.handleMemoryKey(key));
          }, (key: string) => key);
        }
        .width('100%')
        .height(this.isScientific ? 40 : 44)
        .padding({ left: 16, right: 16 })
        .justifyContent(FlexAlign.SpaceBetween)
        .alignItems(VerticalAlign.Center);

        Column() {
          if (this.isScientific) {
            // 3 行 × 6 列 = 18 键单页布局；Swiper 框架保留以便将来扩展键位（双曲线、统计等）时分页
            Swiper() {
              this.ScientificKeyGrid(this.scientificKeys);
            }
            .index(0)
            .loop(false)
            .autoPlay(false)
            .indicator(false)
            .height(130);
          }

          Row() {
            ForEach(keysModel.getPressKeys(), (columnItem: Array<PressKeyItem>, columnItemIndex?: number) => {
              Column({ space: this.isScientific ? 10 : 0 }) {
                ForEach(columnItem, (keyItem: PressKeyItem, keyItemIndex?: number) => {
                  Column() {
                    if (keyItem.flag === 0) {
                      Image(keyItem.source !== undefined ? keyItem.source : '')
                        .width(keyItem.width)
                        .height(keyItem.height);
                    } else if (keyItem.flag === 3) {
                      Text(keyItem.value)
                        .fontSize(34)
                        .fontColor(Color.White)
                        .textAlign(TextAlign.Center);
                    } else {
                      Text(keyItem.value)
                        .fontColor(keyItem.flag === 2 ? this.primaryColor() : '#172033')
                        .fontSize(this.isScientific ? 23 : 26)
                        .textAlign(TextAlign.Center);
                    }
                  }
                  .width(64)
                  .height(this.keyHeight(columnItemIndex, keyItemIndex, columnItem.length))
                  .borderRadius(32)
                  .backgroundColor(this.isEqualKey(columnItemIndex, keyItemIndex, columnItem.length) ?
                    this.primaryColor() : Color.White)
                  .shadow({ radius: 8, color: 'rgba(45, 66, 96, 0.16)', offsetY: 3 })
                  .scale({
                    x: this.pressedKey === keyItem.value ? 0.91 : 1,
                    y: this.pressedKey === keyItem.value ? 0.91 : 1
                  })
                  .animation({ duration: 105, curve: Curve.EaseOut })
                  .alignItems(HorizontalAlign.Center)
                  .justifyContent(FlexAlign.Center)
                  .onTouch((event: TouchEvent) => this.handleTouch(event, keyItem.value))
                  .gesture(
                    LongPressGesture({ repeat: false, duration: 550 })
                      .onAction(() => this.handleLongPress(keyItem.value))
                  )
                  .onClick(() => this.handleStandardKey(keyItem));
                }, (keyItem: PressKeyItem) => JSON.stringify(keyItem));
              }
              .justifyContent(this.isScientific ? FlexAlign.Start : FlexAlign.SpaceBetween)
              .alignItems(HorizontalAlign.Center)
              .height('100%');
            }, (item: Array<Array<PressKeyItem>>) => JSON.stringify(item));
          }
          .margin({ top: this.isScientific ? 12 : 0 })
          .width('100%')
          .height(this.isScientific ? 330 : '100%')
          .alignItems(VerticalAlign.Center)
          .justifyContent(FlexAlign.SpaceBetween);
        }
        .padding({
          top: this.isScientific ? 6 : 16,
          left: 16,
          right: 16,
          bottom: this.uiContext.px2vp(this.bottomRectHeight) + 16
        })
        .width('100%')
        .layoutWeight(1)
        .justifyContent(this.isScientific ? FlexAlign.Center : FlexAlign.Start)
        .borderRadius({ topLeft: 22, topRight: 22 })
        .backgroundColor('#F1F3F7')
        .animation({ duration: 220, curve: Curve.EaseOut });
      }
      .width('100%')
      .height('100%')
      .backgroundColor('#FFFFFF');

      if (this.showMoreMenu) {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor('rgba(0, 0, 0, 0.01)')
          .onClick(() => {
            this.showMoreMenu = false;
          });

        Column({ space: 4 }) {
          Text('历史记录')
            .fontSize(15)
            .fontColor('#27364F')
            .width('100%')
            .padding(11)
            .borderRadius(12)
            .onClick(() => this.openMoreFeature('history'));
          Text('单位换算')
            .fontSize(15)
            .fontColor('#27364F')
            .width('100%')
            .padding(11)
            .borderRadius(12)
            .onClick(() => this.openMoreFeature('converter'));
          Text('日期计算')
            .fontSize(15)
            .fontColor('#27364F')
            .width('100%')
            .padding(11)
            .borderRadius(12)
            .onClick(() => this.openMoreFeature('date'));
          Divider()
            .color('#E8EBF0')
            .margin({ top: 3, bottom: 5 });
          Text('主题色')
            .fontSize(13)
            .fontColor('#8992A3')
            .width('100%');
          Row({ space: 10 }) {
            ForEach(this.themeColors, (color: string, index: number) => {
              Text(this.themeIndex === index ? '✓' : '')
                .fontSize(15)
                .fontWeight(FontWeight.Bold)
                .fontColor(Color.White)
                .textAlign(TextAlign.Center)
                .width(28)
                .height(28)
                .borderRadius(14)
                .backgroundColor(color)
                .border({ width: this.themeIndex === index ? 2 : 0, color: '#FFFFFF' })
                .shadow({ radius: 4, color: 'rgba(20, 30, 50, 0.18)' })
                .onClick(() => {
                  this.themeIndex = index;
                });
            }, (color: string) => color);
          }
          .width('100%')
          .margin({ top: 5 })
          .justifyContent(FlexAlign.Center);
        }
        .width(176)
        .padding(10)
        .margin({ top: this.uiContext.px2vp(this.topRectHeight) + 55, right: 12 })
        .borderRadius(18)
        .backgroundColor(Color.White)
        .shadow({ radius: 18, color: 'rgba(18, 28, 45, 0.22)', offsetY: 6 })
        .transition(TransitionEffect.OPACITY.combine(TransitionEffect.translate({ y: -12 })));
      }

      if (this.showHistory) {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor('rgba(18, 28, 45, 0.28)')
          .onClick(() => {
            this.showHistory = false;
          });

        Column() {
          Row() {
            Text('计算历史')
              .fontSize(22)
              .fontWeight(FontWeight.Bold)
              .fontColor('#172033');
            Text('关闭')
              .fontSize(14)
              .fontColor(this.primaryColor())
              .onClick(() => {
                this.showHistory = false;
              });
          }
          .width('100%')
          .justifyContent(FlexAlign.SpaceBetween);

          if (this.historyRecords.length === 0) {
            Column() {
              Text('暂无计算记录')
                .fontSize(16)
                .fontColor('#8992A3');
              Text('完成计算后会显示在这里')
                .fontSize(13)
                .fontColor('#B0B7C3')
                .margin({ top: 8 });
            }
            .layoutWeight(1)
            .justifyContent(FlexAlign.Center);
          } else {
            List({ space: 10 }) {
              ForEach(this.historyRecords, (record: string) => {
                ListItem() {
                  Text(record)
                    .fontSize(16)
                    .fontColor('#27364F')
                    .textAlign(TextAlign.End)
                    .width('100%')
                    .padding(14)
                    .borderRadius(14)
                    .backgroundColor('#F5F7FB');
                }
              }, (record: string) => record);
            }
            .layoutWeight(1)
            .width('100%')
            .margin({ top: 18 });

            Text('清空全部记录')
              .fontSize(15)
              .fontWeight(FontWeight.Medium)
              .fontColor('#E44848')
              .textAlign(TextAlign.Center)
              .width('100%')
              .height(44)
              .borderRadius(22)
              .backgroundColor('#FFF0F0')
              .onClick(() => {
                this.historyRecords = [];
              });
          }
        }
        .width('88%')
        .height('72%')
        .padding(20)
        .margin({ top: this.uiContext.px2vp(this.topRectHeight) + 70, right: 12 })
        .borderRadius(24)
        .backgroundColor(Color.White)
        .shadow({ radius: 24, color: 'rgba(18, 28, 45, 0.24)', offsetY: 8 })
        .transition(TransitionEffect.OPACITY.combine(TransitionEffect.translate({ x: 80 })));
      }

      if (this.showConverter) {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor('rgba(18, 28, 45, 0.28)')
          .onClick(() => {
            this.showConverter = false;
          });

        Column() {
          Row() {
            Text('单位换算')
              .fontSize(22)
              .fontWeight(FontWeight.Bold)
              .fontColor('#172033');
            Text('关闭')
              .fontSize(14)
              .fontColor(this.primaryColor())
              .onClick(() => {
                this.showConverter = false;
              });
          }
          .width('100%')
          .justifyContent(FlexAlign.SpaceBetween);

          Row({ space: 5 }) {
            ForEach(this.converterCategories, (category: string, index: number) => {
              Text(category)
                .fontSize(13)
                .fontWeight(this.converterCategoryIndex === index ? FontWeight.Bold : FontWeight.Regular)
                .fontColor(this.converterCategoryIndex === index ? Color.White : '#667085')
                .textAlign(TextAlign.Center)
                .padding({ left: 9, right: 9, top: 7, bottom: 7 })
                .borderRadius(15)
                .backgroundColor(this.converterCategoryIndex === index ? this.primaryColor() : '#F0F3F8')
                .onClick(() => this.changeConverterCategory(index));
            }, (category: string) => category);
          }
          .width('100%')
          .margin({ top: 16 })
          .justifyContent(FlexAlign.Center);

          Row() {
            Column() {
              Text(this.converterFromUnit() + '  ›')
                .fontSize(14)
                .fontColor(this.primaryColor())
                .onClick(() => this.cycleConverterUnit(true));
              Text(this.converterInput.length === 0 ? '0' : this.converterInput)
                .fontSize(28)
                .fontWeight(FontWeight.Bold)
                .fontColor('#172033')
                .maxLines(1)
                .margin({ top: 12 });
            }
            .width('43%')
            .height(104)
            .padding(14)
            .alignItems(HorizontalAlign.End)
            .borderRadius(18)
            .backgroundColor('#F6F8FC');

            Text('⇄')
              .fontSize(24)
              .fontColor(this.primaryColor())
              .textAlign(TextAlign.Center)
              .width('14%')
              .onClick(() => this.swapConverterUnits());

            Column() {
              Text(this.converterToUnit() + '  ›')
                .fontSize(14)
                .fontColor(this.primaryColor())
                .onClick(() => this.cycleConverterUnit(false));
              Text(this.converterResult())
                .fontSize(28)
                .fontWeight(FontWeight.Bold)
                .fontColor(this.primaryColor())
                .maxLines(1)
                .margin({ top: 12 });
            }
            .width('43%')
            .height(104)
            .padding(14)
            .alignItems(HorizontalAlign.End)
            .borderRadius(18)
            .backgroundColor(this.themeLightColor());
          }
          .width('100%')
          .margin({ top: 16 })
          .alignItems(VerticalAlign.Center);

          Text('点击单位名称切换单位')
            .fontSize(12)
            .fontColor('#98A1B2')
            .margin({ top: 8, bottom: 12 });

          Grid() {
            ForEach(this.converterKeys, (key: string) => {
              GridItem() {
                Text(key === 'del' ? '⌫' : key)
                  .fontSize(key === '交换' || key === '完成' ? 15 : 22)
                  .fontWeight(FontWeight.Medium)
                  .fontColor(key === '完成' ? Color.White : '#27364F')
                  .textAlign(TextAlign.Center)
                  .width('100%')
                  .height('100%');
              }
              .height(50)
              .borderRadius(18)
              .backgroundColor(key === '完成' ? this.primaryColor() : Color.White)
              .shadow({ radius: 6, color: 'rgba(45, 66, 96, 0.13)', offsetY: 2 })
              .scale({ x: this.pressedKey === 'unit_' + key ? 0.93 : 1,
                y: this.pressedKey === 'unit_' + key ? 0.93 : 1 })
              .animation({ duration: 100, curve: Curve.EaseOut })
              .onTouch((event: TouchEvent) => this.handleTouch(event, 'unit_' + key))
              .onClick(() => this.handleConverterKey(key));
            }, (key: string) => key);
          }
          .columnsTemplate('1fr 1fr 1fr 1fr')
          .columnsGap(9)
          .rowsGap(9)
          .height(227)
          .width('100%');
        }
        .width('94%')
        .height('82%')
        .padding(18)
        .margin({ top: this.uiContext.px2vp(this.topRectHeight) + 58, right: 10 })
        .borderRadius(26)
        .backgroundColor(Color.White)
        .shadow({ radius: 24, color: 'rgba(18, 28, 45, 0.24)', offsetY: 8 })
        .transition(TransitionEffect.OPACITY.combine(TransitionEffect.translate({ y: 50 })));
      }

      if (this.showDateCalculator) {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor('rgba(18, 28, 45, 0.28)')
          .onClick(() => {
            this.showDateCalculator = false;
          });

        Column() {
          Row() {
            Text('日期计算')
              .fontSize(22)
              .fontWeight(FontWeight.Bold)
              .fontColor('#172033');
            Text('关闭')
              .fontSize(14)
              .fontColor(this.primaryColor())
              .onClick(() => {
                this.showDateCalculator = false;
              });
          }
          .width('100%')
          .justifyContent(FlexAlign.SpaceBetween);

          Row() {
            Text('日期间隔')
              .fontSize(14)
              .fontWeight(this.dateBetweenMode ? FontWeight.Bold : FontWeight.Regular)
              .fontColor(this.dateBetweenMode ? Color.White : '#667085')
              .textAlign(TextAlign.Center)
              .width('50%')
              .height(36)
              .borderRadius(18)
              .backgroundColor(this.dateBetweenMode ? this.primaryColor() : Color.Transparent)
              .onClick(() => {
                this.dateBetweenMode = true;
              });
            Text('距离今天')
              .fontSize(14)
              .fontWeight(this.dateBetweenMode ? FontWeight.Regular : FontWeight.Bold)
              .fontColor(this.dateBetweenMode ? '#667085' : Color.White)
              .textAlign(TextAlign.Center)
              .width('50%')
              .height(36)
              .borderRadius(18)
              .backgroundColor(this.dateBetweenMode ? Color.Transparent : this.primaryColor())
              .onClick(() => {
                this.dateBetweenMode = false;
              });
          }
          .width('100%')
          .padding(2)
          .margin({ top: 16 })
          .borderRadius(20)
          .backgroundColor('#EEF2F7');

          if (this.dateBetweenMode) {
            Text('开始日期  ' + this.formatDate(this.startDate))
              .fontSize(15)
              .fontWeight(FontWeight.Medium)
              .fontColor('#27364F')
              .width('100%')
              .margin({ top: 15 });
            DatePicker({
              start: new Date(1900, 0, 1),
              end: new Date(2100, 11, 31),
              selected: this.startDate
            })
              .height(132)
              .onDateChange((value: Date) => this.updatePickedDate(value, true));

            Text('结束日期  ' + this.formatDate(this.endDate))
              .fontSize(15)
              .fontWeight(FontWeight.Medium)
              .fontColor('#27364F')
              .width('100%')
              .margin({ top: 5 });
            DatePicker({
              start: new Date(1900, 0, 1),
              end: new Date(2100, 11, 31),
              selected: this.endDate
            })
              .height(132)
              .onDateChange((value: Date) => this.updatePickedDate(value, false));
          } else {
            Text('目标日期  ' + this.formatDate(this.endDate))
              .fontSize(15)
              .fontWeight(FontWeight.Medium)
              .fontColor('#27364F')
              .width('100%')
              .margin({ top: 20 });
            DatePicker({
              start: new Date(1900, 0, 1),
              end: new Date(2100, 11, 31),
              selected: this.endDate
            })
              .height(210)
              .onDateChange((value: Date) => this.updatePickedDate(value, false));
          }

          Column() {
            Text(this.dateCalculationResult())
              .fontSize(21)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.primaryColor())
              .textAlign(TextAlign.Center)
              .maxLines(2);
            Text(this.dateBetweenMode ? '按自然日计算，不包含起始当天' : '以设备当前本地日期为准')
              .fontSize(12)
              .fontColor('#8992A3')
              .margin({ top: 7 });
          }
          .width('100%')
          .padding(18)
          .margin({ top: 12 })
          .borderRadius(18)
          .backgroundColor(this.themeLightColor());
        }
        .width('94%')
        .height('82%')
        .padding(18)
        .margin({ top: this.uiContext.px2vp(this.topRectHeight) + 58, right: 10 })
        .borderRadius(26)
        .backgroundColor(Color.White)
        .shadow({ radius: 24, color: 'rgba(18, 28, 45, 0.24)', offsetY: 8 })
        .transition(TransitionEffect.OPACITY.combine(TransitionEffect.translate({ y: 50 })));
      }
    }
    .width('100%')
    .height('100%');
  }

  primaryColor(): string {
    const colors = this.themeColors;
    const idx = this.themeIndex;
    if (!colors || idx === undefined || idx < 0 || idx >= colors.length) {
      return '#3478F6';
    }
    return colors[idx];
  }

  themeLightColor(): string {
    const colors = this.themeLightColors;
    const idx = this.themeIndex;
    if (!colors || idx === undefined || idx < 0 || idx >= colors.length) {
      return '#EEF4FF';
    }
    return colors[idx];
  }

  openMoreFeature(feature: string): void {
    this.showMoreMenu = false;
    this.showHistory = feature === 'history';
    this.showConverter = feature === 'converter';
    this.showDateCalculator = feature === 'date';
  }

  updatePickedDate(value: Date, isStart: boolean): void {
    let pickedDate = new Date(value.getFullYear(), value.getMonth(), value.getDate());
    if (isStart) {
      this.startDate = pickedDate;
    } else {
      this.endDate = pickedDate;
    }
  }

  formatDate(value: Date): string {
    let month = (value.getMonth() + 1).toString().padStart(2, '0');
    let day = value.getDate().toString().padStart(2, '0');
    return value.getFullYear().toString() + '-' + month + '-' + day;
  }

  calendarDayNumber(value: Date): number {
    return Math.floor(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000);
  }

  dateCalculationResult(): string {
    if (this.dateBetweenMode) {
      let difference = Math.abs(this.calendarDayNumber(this.endDate) - this.calendarDayNumber(this.startDate));
      return this.formatDate(this.startDate) + ' 到 ' + this.formatDate(this.endDate) + ' 相差 ' +
        difference.toString() + ' 天';
    }
    let now = new Date();
    let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let difference = this.calendarDayNumber(this.endDate) - this.calendarDayNumber(today);
    if (difference > 0) {
      return '距离 ' + this.formatDate(this.endDate) + ' 还有 ' + difference.toString() + ' 天';
    }
    if (difference < 0) {
      return '距离 ' + this.formatDate(this.endDate) + ' 已经过去 ' + Math.abs(difference).toString() + ' 天';
    }
    return this.formatDate(this.endDate) + ' 就是今天';
  }

  converterUnits(): Array<string> {
    switch (this.converterCategoryIndex) {
      case 0:
        return ['米', '千米', '厘米', '毫米', '英寸', '英尺'];
      case 1:
        return ['千克', '克', '吨', '磅'];
      case 2:
        return ['℃', '℉', 'K'];
      case 3:
        return ['平方米', '平方千米', '平方厘米', '亩', '公顷'];
      case 4:
        return ['升', '毫升', '立方米', '加仑'];
      default:
        return ['B', 'KB', 'MB', 'GB', 'TB'];
    }
  }

  converterFromUnit(): string {
    return this.converterUnits()[this.converterFromIndex];
  }

  converterToUnit(): string {
    return this.converterUnits()[this.converterToIndex];
  }

  changeConverterCategory(index: number): void {
    this.converterCategoryIndex = index;
    this.converterFromIndex = 0;
    this.converterToIndex = 1;
  }

  cycleConverterUnit(fromUnit: boolean): void {
    let unitCount = this.converterUnits().length;
    if (fromUnit) {
      this.converterFromIndex = (this.converterFromIndex + 1) % unitCount;
    } else {
      this.converterToIndex = (this.converterToIndex + 1) % unitCount;
    }
  }

  swapConverterUnits(): void {
    let oldFrom = this.converterFromIndex;
    this.converterFromIndex = this.converterToIndex;
    this.converterToIndex = oldFrom;
  }

  handleConverterKey(key: string): void {
    if (key === '完成') {
      this.showConverter = false;
      return;
    }
    if (key === '交换') {
      this.swapConverterUnits();
      return;
    }
    if (key === 'C') {
      this.converterInput = '';
      return;
    }
    if (key === 'del') {
      this.converterInput = this.converterInput.slice(0, Math.max(0, this.converterInput.length - 1));
      return;
    }
    if (key === '±') {
      if (this.converterInput.startsWith('-')) {
        this.converterInput = this.converterInput.slice(1);
      } else if (this.converterInput.length > 0 && this.converterInput !== '0') {
        this.converterInput = '-' + this.converterInput;
      }
      return;
    }
    if (key === '.') {
      if (this.converterInput.indexOf('.') === -1) {
        this.converterInput = this.converterInput.length === 0 ? '0.' : this.converterInput + '.';
      }
      return;
    }
    if (this.converterInput === '0') {
      this.converterInput = key;
    } else if (this.converterInput.length < 18) {
      this.converterInput += key;
    }
  }

  converterResult(): string {
    if (this.converterInput.length === 0 || this.converterInput === '-' || this.converterInput === '.') {
      return '0';
    }
    let value = Number(this.converterInput);
    let result: number;
    if (this.converterCategoryIndex === 2) {
      result = this.convertTemperature(value, this.converterFromUnit(), this.converterToUnit());
    } else {
      result = value * this.unitFactor(this.converterFromUnit()) / this.unitFactor(this.converterToUnit());
    }
    return this.formatConverterNumber(result);
  }

  convertTemperature(value: number, fromUnit: string, toUnit: string): number {
    let celsius = value;
    if (fromUnit === '℉') {
      celsius = (value - 32) * 5 / 9;
    } else if (fromUnit === 'K') {
      celsius = value - 273.15;
    }
    if (toUnit === '℉') {
      return celsius * 9 / 5 + 32;
    }
    if (toUnit === 'K') {
      return celsius + 273.15;
    }
    return celsius;
  }

  unitFactor(unit: string): number {
    switch (unit) {
      case '米': return 1;
      case '千米': return 1000;
      case '厘米': return 0.01;
      case '毫米': return 0.001;
      case '英寸': return 0.0254;
      case '英尺': return 0.3048;
      case '千克': return 1;
      case '克': return 0.001;
      case '吨': return 1000;
      case '磅': return 0.45359237;
      case '平方米': return 1;
      case '平方千米': return 1000000;
      case '平方厘米': return 0.0001;
      case '亩': return 666.6666667;
      case '公顷': return 10000;
      case '升': return 1;
      case '毫升': return 0.001;
      case '立方米': return 1000;
      case '加仑': return 3.785411784;
      case 'KB': return 1024;
      case 'MB': return 1048576;
      case 'GB': return 1073741824;
      case 'TB': return 1099511627776;
      default: return 1;
    }
  }

  formatConverterNumber(value: number): string {
    if (value !== value || value === Number.POSITIVE_INFINITY || value === Number.NEGATIVE_INFINITY) {
      return 'error';
    }
    let absoluteValue = Math.abs(value);
    if (absoluteValue !== 0 && (absoluteValue >= 1000000000000 || absoluteValue < 0.00000001)) {
      return value.toExponential(6);
    }
    return Number(value.toPrecision(10)).toString();
  }

  switchMode(scientific: boolean): void {
    this.isScientific = scientific;
    this.pressedKey = '';
  }

  isScienceToggleActive(key: string): boolean {
    return (key === 'Inv' && this.inverseMode) || (key === 'Rad' && !this.angleInDegree);
  }

  scienceKeyLabel(key: string): string {
    if (key === 'Inv') {
      return 'INV';
    }
    if (!this.inverseMode) {
      return key;
    }
    switch (key) {
      case 'sin': return 'sin⁻¹';
      case 'cos': return 'cos⁻¹';
      case 'tan': return 'tan⁻¹';
      case 'ln': return 'eˣ';
      case 'log': return '10ˣ';
      default: return key;
    }
  }

  handleTouch(event: TouchEvent, key: string): void {
    if (event.type === TouchType.Down) {
      this.pressedKey = key;
    } else {
      this.pressedKey = '';
    }
  }

  isEqualKey(columnIndex: number | undefined, keyIndex: number | undefined, columnLength: number): boolean {
    return columnIndex === keysModel.getPressKeys().length - 1 && keyIndex === columnLength - 1;
  }

  keyHeight(columnIndex: number | undefined, keyIndex: number | undefined, columnLength: number): number {
    if (this.isEqualKey(columnIndex, keyIndex, columnLength)) {
      return this.isScientific ? 126 : 148;
    }
    return this.isScientific ? 58 : 64;
  }

  handleStandardKey(keyItem: PressKeyItem): void {
    if (keyItem.flag === 0 || keyItem.flag === 2 || keyItem.flag === 3) {
      this.inputSymbol(keyItem.value);
      return;
    }
    if (this.lastBtnIsEqu) {
      this.expressions = [];
    }
    this.lastBtnIsEqu = false;
    this.inputNumber(keyItem.value);
  }

  handleLongPress(key: string): void {
    if (key === Symbol.DEL) {
      this.clearCurrentInput();
    }
  }

  clearCurrentInput(): void {
    this.expressions = [];
    this.inputValue = '';
    this.calValue = '';
    this.lastBtnIsEqu = false;
  }

  addHistory(expression: string, result: string): void {
    if (expression.length === 0 || result.length === 0) {
      return;
    }
    let newHistory: Array<string> = Array.from(this.historyRecords);
    newHistory.unshift(expression + ' = ' + result);
    if (newHistory.length > 30) {
      newHistory.pop();
    }
    this.historyRecords = newHistory;
  }

  handleMemoryKey(key: string): void {
    if (key === 'MC') {
      this.memoryValue = 0;
      return;
    }
    if (key === 'MR') {
      let memoryText = this.formatScientificResult(this.memoryValue);
      this.expressions = [memoryText];
      this.inputValue = memoryText;
      this.calValue = '';
      this.lastBtnIsEqu = false;
      return;
    }

    let currentValue = this.getCurrentNumber();
    if (currentValue !== currentValue) {
      return;
    }
    if (key === 'M+') {
      this.memoryValue += currentValue;
    } else if (key === 'M-') {
      this.memoryValue -= currentValue;
    }
  }

  getCurrentNumber(): number {
    if (this.expressions.length === 0) {
      return Number.NaN;
    }
    let result = CalculateUtil.parseExpression(this.deepCopy());
    return result === 'NaN' ? Number.NaN : Number(result);
  }

  insertConstant(value: number): void {
    let numberValue = this.formatScientificResult(value);
    let len = this.expressions.length;
    if (this.lastBtnIsEqu) {
      this.expressions = [numberValue];
    } else if (len === 0 || CalculateUtil.isSymbol(this.expressions[len - 1]) ||
      this.expressions[len - 1] === '(') {
      this.expressions.push(numberValue);
    } else if (this.expressions[len - 1] === ')') {
      this.expressions.push(CommonConstants.MUL);
      this.expressions.push(numberValue);
    } else {
      this.expressions[len - 1] = numberValue;
    }
    this.lastBtnIsEqu = false;
    this.formatInputValue();
    this.getResult();
  }

  applyScientificFunction(key: string): void {
    if (key === 'Inv') {
      this.inverseMode = !this.inverseMode;
      return;
    }
    if (key === 'Rad') {
      this.angleInDegree = !this.angleInDegree;
      return;
    }
    if (key === '(' || key === ')') {
      this.inputParenthesis(key);
      return;
    }
    if (key === 'xʸ') {
      this.inputOperators(this.expressions.length, CommonConstants.POWER);
      this.formatInputValue();
      return;
    }
    if (key === 'ʸ√x') {
      this.inputOperators(this.expressions.length, CommonConstants.ROOT);
      this.formatInputValue();
      return;
    }
    if (key === 'π') {
      this.insertConstant(Math.PI);
      return;
    }
    if (key === 'e') {
      this.insertConstant(Math.E);
      return;
    }
    if (this.expressions.length === 0) {
      return;
    }

    let sourceExpression = this.inputValue;
    let sourceResult = CalculateUtil.parseExpression(this.deepCopy());
    if (sourceResult === 'NaN') {
      this.calValue = this.resourceToString($r('app.string.error'));
      return;
    }

    let value = Number(sourceResult);
    let result = Number.NaN;
    let historyExpression = key + '(' + sourceExpression + ')';
    let angle = this.angleInDegree ? value * Math.PI / 180 : value;
    switch (key) {
      case 'sin':
        result = this.inverseMode ? this.inverseAngle(Math.asin(value)) : Math.sin(angle);
        break;
      case 'cos':
        result = this.inverseMode ? this.inverseAngle(Math.acos(value)) : Math.cos(angle);
        break;
      case 'tan':
        result = this.inverseMode ? this.inverseAngle(Math.atan(value)) : Math.tan(angle);
        break;
      case '√':
        result = Math.sqrt(value);
        historyExpression = '√(' + sourceExpression + ')';
        break;
      case 'x²':
        result = value * value;
        historyExpression = '(' + sourceExpression + ')²';
        break;
      case 'x³':
        result = value * value * value;
        historyExpression = '(' + sourceExpression + ')³';
        break;
      case 'ln':
        result = this.inverseMode ? Math.exp(value) : Math.log(value);
        historyExpression = this.inverseMode ? 'e^(' + sourceExpression + ')' : historyExpression;
        break;
      case 'log':
        result = this.inverseMode ? Math.pow(10, value) : Math.log(value) / Math.LN10;
        historyExpression = this.inverseMode ? '10^(' + sourceExpression + ')' : historyExpression;
        break;
      case '1/x':
        result = 1 / value;
        break;
      case 'x!':
        result = this.factorial(value);
        historyExpression = '(' + sourceExpression + ')!';
        break;
      default:
        return;
    }

    let formatted = this.formatScientificResult(result);
    if (formatted === 'NaN') {
      this.calValue = this.resourceToString($r('app.string.error'));
      return;
    }
    this.addHistory(historyExpression, formatted);
    this.expressions = [formatted];
    this.inputValue = formatted;
    this.calValue = '';
    this.lastBtnIsEqu = true;
  }

  inverseAngle(radianValue: number): number {
    return this.angleInDegree ? radianValue * 180 / Math.PI : radianValue;
  }

  inputParenthesis(value: string): void {
    let len = this.expressions.length;
    let last = len > 0 ? this.expressions[len - 1] : '';
    if (value === '(') {
      if (last === ')' || (last.length > 0 && !CalculateUtil.isSymbol(last) && last !== '(')) {
        this.expressions.push(CommonConstants.MUL);
      }
      this.expressions.push('(');
    } else {
      let openCount = this.expressions.filter((item: string) => item === '(').length;
      let closeCount = this.expressions.filter((item: string) => item === ')').length;
      if (openCount <= closeCount || last.length === 0 || last === '(' || CalculateUtil.isSymbol(last)) {
        return;
      }
      this.expressions.push(')');
    }
    this.lastBtnIsEqu = false;
    this.formatInputValue();
    this.getResult();
  }

  factorial(value: number): number {
    if (value < 0 || value !== Math.floor(value) || value > 170) {
      return Number.NaN;
    }
    let result = 1;
    for (let index = 2; index <= value; index++) {
      result *= index;
    }
    return result;
  }

  formatScientificResult(value: number): string {
    if (value !== value || value === Number.POSITIVE_INFINITY || value === Number.NEGATIVE_INFINITY) {
      return 'NaN';
    }
    if (Math.abs(value) < 0.000000000001) {
      return '0';
    }
    return Number(value.toPrecision(12)).toString();
  }

  /**
   * Input Symbols.
   * 输入
   *
   * @param value Input Operators.
   */
  inputSymbol(value: string) {
    if (CheckEmptyUtil.isEmpty(value)) {
      return;
    }
    let len = this.expressions.length;
    let wasEqual = this.lastBtnIsEqu;
    this.lastBtnIsEqu = false;
    switch (value) {
      case Symbol.CLEAN:
        this.expressions = [];
        this.calValue = '';
        break;
      case Symbol.DEL:
        if (wasEqual) {
          this.clearCurrentInput();
        } else {
          this.inputDelete(len);
        }
        break;
      case Symbol.EQU:
        if (len === 0) {
          return;
        }
        this.closeOpenParentheses();
        let historyExpression = this.inputValue;
        this.getResult().then((result: boolean) => {
          if (!result) {
            return;
          }
          this.addHistory(historyExpression, this.calValue);
          this.inputValue = this.calValue;
          this.calValue = '';
          this.expressions = [];
          this.expressions.push(this.inputValue);
          this.lastBtnIsEqu = true;
          this.animateResult();
        });
        break;
      default:
        this.inputOperators(len, value);
        break;
    }
    this.formatInputValue();
  }

  /**
   * Enter numbers.
   * 结果
   *
   * @param value Enter numbers.
   */
  inputNumber(value: string) {
    if (CheckEmptyUtil.isEmpty(value)) {
      return;
    }
    let len = this.expressions.length;
    let last = len > 0 ? this.expressions[len - 1] : '';
    let secondLast = len > 1 ? this.expressions[len - CommonConstants.TWO] : undefined;
    let unaryMinus = last === CommonConstants.MIN &&
      (len === 1 || secondLast === '(' || (secondLast !== undefined && CalculateUtil.isSymbol(secondLast)));
    if (unaryMinus) {
      this.expressions[len - 1] = value === CommonConstants.DOTS ? '-0.' : '-' + value;
    } else if (!last || CalculateUtil.isSymbol(last) || last === '(') {
      this.expressions.push(value);
    } else if (last === ')') {
      this.expressions.push(CommonConstants.MUL);
      this.expressions.push(value);
    } else {
      if (!this.validateEnter(last, value)) {
        return;
      }
      this.expressions[len - 1] += value;
    }
    this.formatInputValue();
    if (value !== CommonConstants.DOTS) {
      this.getResult();
    }
  }

  /**
   * Verify that you can enter.
   *
   * @param last Value of the last element.
   * @param value Current input value.
   * return Indicates whether to allow input.
   */
  validateEnter(last: string, value: string) {
    if (!last && value === CommonConstants.PERCENT_SIGN) {
      return false;
    }
    if ((last === CommonConstants.MIN) && (value === CommonConstants.PERCENT_SIGN)) {
      return false;
    }
    if (last.endsWith(CommonConstants.PERCENT_SIGN)) {
      return false;
    }
    if ((last.indexOf(CommonConstants.DOTS) !== -1) && (value === CommonConstants.DOTS)) {
      return false;
    }
    if ((last === '0') && (value !== CommonConstants.DOTS) &&
      (value !== CommonConstants.PERCENT_SIGN)) {
      return false;
    }
    return true;
  }

  /**
   * Delete Key Trigger.
   *
   * @param len Expression Length.
   */
  inputDelete(len: number) {
    if (len === 0) {
      return;
    }
    let last = this.expressions[len - 1];
    let lastLen = last.length;
    if (lastLen === 1) {
      this.expressions.pop();
      len = this.expressions.length;
    } else {
      this.expressions[len - 1] = last.slice(0, last.length - 1);
    }
    if (len === 0) {
      this.inputValue = '';
      this.calValue = '';
      return;
    }
    if (!CalculateUtil.isSymbol(this.expressions[len - 1])) {
      this.getResult();
    }
  }

  /**
   * Triggered when input is added, subtracted, multiplied, and divided.
   *
   * @param len Expression Length.
   * @param value Current Input Value.
   */
  inputOperators(len: number, value: string) {
    let last = len > 0 ? this.expressions[len - 1] : undefined;
    let symbol = this.getSymbol(value);
    if (!last) {
      if (value === Symbol.MIN) {
        this.expressions.push(CommonConstants.MIN);
      }
      return;
    }
    if (last === '(') {
      if (value === Symbol.MIN) {
        this.expressions.push(CommonConstants.MIN);
      }
      return;
    }
    if (!CalculateUtil.isSymbol(last) || last === ')') {
      this.expressions.push(symbol);
      return;
    }
    if (value === Symbol.MIN && last !== CommonConstants.MIN) {
      this.expressions.push(CommonConstants.MIN);
      return;
    }
    this.expressions[len - 1] = symbol;
  }

  /**
   * Get Operator.
   *
   * @param value.
   * @return Operators.
   */
  getSymbol(value: string) {
    if (CheckEmptyUtil.isEmpty(value)) {
      return '';
    }
    let symbol = '';
    switch (value) {
      case Symbol.ADD:
        symbol = CommonConstants.ADD;
        break;
      case Symbol.MIN:
        symbol = CommonConstants.MIN;
        break;
      case Symbol.MUL:
        symbol = CommonConstants.MUL;
        break;
      case Symbol.DIV:
        symbol = CommonConstants.DIV;
        break;
      case CommonConstants.POWER:
        symbol = CommonConstants.POWER;
        break;
      case CommonConstants.ROOT:
        symbol = CommonConstants.ROOT;
        break;
      default:
        break;
    }
    return symbol;
  }

  /**
   * Make a deep copy of an expression.
   *
   * @return deep copy expression.
   */
  deepCopy(): Array<string> {
    let copyExpressions: Array<string> = Array.from(this.expressions);
    return copyExpressions;
  }

  /**
   * Obtaining Results.
   *
   * @return Whether the result is incorrect.
   */
  async getResult() {
    let openCount = this.expressions.filter((item: string) => item === '(').length;
    let closeCount = this.expressions.filter((item: string) => item === ')').length;
    if (openCount !== closeCount) {
      this.calValue = '';
      return false;
    }
    let calResult = CalculateUtil.parseExpression(this.deepCopy());
    if (calResult === 'NaN') {
      this.calValue = this.resourceToString($r('app.string.error'));
      return false;
    }
    this.calValue = calResult;
    return true;
  }

  closeOpenParentheses(): void {
    let openCount = this.expressions.filter((item: string) => item === '(').length;
    let closeCount = this.expressions.filter((item: string) => item === ')').length;
    for (let index = closeCount; index < openCount; index++) {
      this.expressions.push(')');
    }
    this.formatInputValue();
  }

  /**
   * Number Formatting.
   *
   * @param value Formatting parameters.
   * @return Thousand percentile data.
   */
  resultFormat(value: string) {
    let reg = (value.indexOf('.') > -1) ? new RegExp('/(\d)(?=(\d{3})+\.)/g') : new RegExp('/(\d)(?=(?:\d{3})+$)/g');
    return value.replace(reg, '$1,');
  }

  /**
   * Convert a resource file to a string.
   *
   * @param resource Resource file.
   * @return Character string converted from the resource file.
   */
  resourceToString(resource: Resource): string {
    if (CheckEmptyUtil.isEmpty(resource)) {
      return '';
    }
    let result = '';
    try {
      result = (this.uiContext.getHostContext() as common.UIAbilityContext).resourceManager.getStringSync(resource.id);
    } catch (error) {
      Logger.error('[CalculateModel] getResourceString fail: ' + JSON.stringify(error));
    }
    return result;
  }

  /**
   * Thousands in the formatting result.
   */
  formatInputValue() {
    let deepExpressions: Array<string> = [];
    this.deepCopy().forEach((item: string, index: number) => {
      deepExpressions[index] = this.resultFormat(item);
    });
    this.inputValue = deepExpressions.join('').replace(/ʸ√/g, '√');
  }
}
