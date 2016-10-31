$( document ).ready(function() {
	var scrl = $(window).scrollTop();
	if(scrl > 70){
	    $('.navbar').removeClass('bg-faded-trans');
	    $('.navbar').addClass('bg-faded');
	    $(".nav-masthead .nav-link").css('color', "#012E78");
	    $('#lgBlue').css("display","inherit");
	    $(".navbar-toggler").css('color', "#333");
	}
	var aboutOs = $('#about').offset().top;
	var whoOs = $('#whoIsThis').offset().top;
	var partnersOs = $('#partners').offset().top;
	$( "#aboutThis" ).on( "click", function() {
	  $('html, body').animate({
          scrollTop: $("#about").offset().top -50
      }, 1000);
	});

	$( "#who" ).on( "click", function() {
	  $('html, body').animate({
          scrollTop: $("#whoIsThis").offset().top -50
      }, 1000);
	});

	$( "#projPartners" ).on( "click", function() {
	  $('html, body').animate({
          scrollTop: $("#partners").offset().top -50
      }, 1000);
	});

	$( "#goTo" ).on( "click", function() {
	  $('html, body').animate({
          scrollTop: $(".tools").offset().top -80
      }, 1000);
	});

	$( ".scrollUp" ).on( "click", function() {
	  $('html, body').animate({
          scrollTop: 0
      }, 1000);
	});

    $(window).scroll(function() {
	  var scrollNum = $(window).scrollTop();
      if(scrollNum > aboutOs -60){
          $('#aboutThis').addClass('active');
      }
      else $('#aboutThis').removeClass('active');
      if(scrollNum > whoOs -60){
		  $('.nav-link').removeClass('active');
          $('#who').addClass('active');
      }
      else $('#who').removeClass('active');
      if(scrollNum > partnersOs -60){
		  $('.nav-link').removeClass('active');
          $('#projPartners').addClass('active');
      }
      else $('#projPartners').removeClass('active');
	  if(scrollNum > 70){
	    $('.navbar').removeClass('bg-faded-trans');
	    $('.navbar').addClass('bg-faded');
	    $(".nav-masthead .nav-link").css('color', "#012E78");
	    $('#lgBlue').css("display","inherit");
	    $(".navbar-toggler").css('color', "#333");
	  }
	  else {
	  	$('.navbar').removeClass('bg-faded');
	  	$('.navbar').addClass('bg-faded-trans');
	  	$(".nav-masthead .nav-link").css('color', "#fff");
	  	$('#lgBlue').css("display","none");
	  	$(".navbar-toggler").css('color', "#fff");
	  }
	});

	$('.navbar-toggler').click(function() {
	   var nav = $('.navbar-light');
	   var navClasses = nav[0].classList;
	   var thisClasses = this.classList;
	   var expand = $(this).attr('aria-expanded');
	   if(expand == 'false'){
		   if(navClasses[3] == 'bg-faded-trans'){
		   	$(nav).removeClass('bg-faded-trans');
		   	$(nav).addClass('bg-faded-semi-trans');
		   }
	   }
	   else{
	   		if(navClasses[3] !== 'bg-faded'){
		   		$(nav).removeClass('bg-faded-semi-trans');
		   		$(nav).addClass('bg-faded-trans');
	   		}
	   }
	});

});