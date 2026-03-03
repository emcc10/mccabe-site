<script>
(function () {

  var room = document.getElementById("mrp-room");
  if (!room) return;

  var seats = [];
  var ARM_INSET = 18; // pixels from image edge to arm center

  function makeDraggable(seat) {
    var drag=false,sx,sy,ox,oy;
    seat.onmousedown=function(e){
      drag=true;
      sx=e.clientX; sy=e.clientY;
      ox=seat.offsetLeft; oy=seat.offsetTop;
      document.onmousemove=function(e){
        if(!drag) return;
        seat.style.left=(ox+e.clientX-sx)+"px";
        seat.style.top =(oy+e.clientY-sy)+"px";
      };
      document.onmouseup=function(){
        drag=false;
        document.onmousemove=null;
        document.onmouseup=null;
        snap(seat);
      };
    };
  }

  function createSeat(x, imgSrc) {
    var seat = document.createElement("div");
    seat.style.position="absolute";
    seat.style.left=x+"px";
    seat.style.top="120px";
    seat.style.cursor="grab";
    seat.style.zIndex=10;

    var img = new Image();
    img.src = imgSrc;
    img.style.display="block";
    img.style.pointerEvents="none";

    img.onload = function () {
      var scale = 0.35; // visual scale (tune later)
      var w = img.naturalWidth * scale;
      var h = img.naturalHeight * scale;

      seat.style.width = w+"px";
      seat.style.height = h+"px";

      img.style.width = "100%";
      img.style.height = "100%";
    };

    seat.appendChild(img);

    // LEFT CONNECTOR (ARM CENTER)
    var leftDot = document.createElement("div");
    leftDot.style.position="absolute";
    leftDot.style.width="8px";
    leftDot.style.height="8px";
    leftDot.style.borderRadius="50%";
    leftDot.style.background="yellow";
    leftDot.style.left = ARM_INSET+"px";
    leftDot.style.top="50%";
    leftDot.style.transform="translate(-50%,-50%)";

    // RIGHT CONNECTOR
    var rightDot = document.createElement("div");
    rightDot.style.position="absolute";
    rightDot.style.width="8px";
    rightDot.style.height="8px";
    rightDot.style.borderRadius="50%";
    rightDot.style.background="yellow";
    rightDot.style.right = ARM_INSET+"px";
    rightDot.style.top="50%";
    rightDot.style.transform="translate(50%,-50%)";

    seat.appendChild(leftDot);
    seat.appendChild(rightDot);

    room.appendChild(seat);
    makeDraggable(seat);
    seats.push(seat);
  }

  function snap(seat) {
    seats.forEach(function(other){
      if(other===seat) return;
      var sameRow=Math.abs(seat.offsetTop-other.offsetTop)<10;
      if(!sameRow) return;

      var gap = ARM_INSET*2;

      if(Math.abs(seat.offsetLeft-(other.offsetLeft+other.offsetWidth-gap))<10){
        seat.style.left=(other.offsetLeft+other.offsetWidth-gap)+"px";
      }
      if(Math.abs((seat.offsetLeft+seat.offsetWidth-gap)-other.offsetLeft)<10){
        seat.style.left=(other.offsetLeft-seat.offsetWidth+gap)+"px";
      }
    });
  }

  // DEMO
  createSeat(100,"/v/vspfiles/MRP/1L.png");
  createSeat(260,"/v/vspfiles/MRP/1L.png");

})();
</script>