class ConstituentsController < ApplicationController

  respond_to :html, :json
  skip_before_filter :verify_authenticity_token, only: [:search]


  def index
  end

  def map
    @admin = params[:admin] != nil
  end

  def search
    client = Elasticsearch::Client.new host: connection_string
    begin
      q = params[:q]
      filter_path = params[:filter_path]
      from = params[:from]
      to = params[:to]
      size = params[:size]
      source = params[:source]
      type = params[:type]
      exclude = params[:exclude]
      sort = "AlphaSort.raw:asc"
      r = client.search index: 'pic', type: type, body: q, size: size, from: from, sort: sort, _source: source, _source_exclude: exclude, filter_path: filter_path
    rescue
      @results = nil
    end
    if r
      @results = r
    end
    render :json => @results
  end

  def export
    client = Elasticsearch::Client.new host: connection_string
    begin
      q = URI.unescape(params[:q])
      fields = ["*"]
      r = client.search index: 'pic', size: 100, body: q, _source: fields
    rescue
      @results = nil
    end
    if r && r["hits"]["total"] > 0
      @results = r["hits"]["hits"]
    end
    render :json => {:results => @results}
  end

  def show
    client = Elasticsearch::Client.new host: connection_string
    begin
      results = client.search index: 'pic', q: "constituent.ConstituentID:#{params[:id]}"
    rescue
      @constituent = nil
    end
    if results && results["hits"]["total"] > 0
      @constituent = results["hits"]["hits"][0]["_source"]
    end
    respond_with @constituent do |f|
      f.html
      f.json
    end
  end

end
