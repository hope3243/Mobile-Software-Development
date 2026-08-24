Page({
    data:{
      list:[
        {wording:'girl', imgs:'../../img/003.png'},
        {wording:'boy', imgs:'../../img/002.png'},
        {wording:'cat', imgs:'../../img/004.png'}
      ],
      index:0
    },
  
    onClick(){
      let newIdx = (this.data.index + 1) % this.data.list.length
      this.setData({
        index: newIdx
      })
    }
  })
  